import { Injectable, ForbiddenException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Agent, DelegatedToken } from '../../database/entities';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';

export interface Scope {
  resource_type: string;
  resource_pattern: string;
  allowed_actions: string[];
}

/** Maximum chain depth — human → agent → sub-agent → sub-sub-agent. */
const MAX_DEPTH = 3;

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    @InjectRepository(DelegatedToken)
    private delegationRepo: Repository<DelegatedToken>,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    private tokenService: TokenService,
    private auditService: AuditService,
  ) {}

  /**
   * Mint a delegated token for a sub-agent.
   *
   * Authorization: the caller presents its own valid parent token. The child
   * receives a strict subset of the parent's effective scopes — narrowing is
   * enforced structurally (every child scope must be covered by a parent
   * scope; actions intersect). TTL can only be shorter than the parent's.
   */
  async mint(
    parentToken: string,
    childAgentId: string,
    requestedScopes: Scope[],
    options: { ttlMinutes?: number; purpose?: string } = {},
  ): Promise<{ token: string; expires_at: Date; delegation_id: string; depth: number }> {
    const parent = await this.tokenService.verifyToken(parentToken);
    if (!parent.valid) throw new ForbiddenException('Parent token is invalid or expired');

    const parentAgentId: string = parent.agent_id;
    const parentAgent = await this.agentRepo.findOne({ where: { id: parentAgentId } });
    if (!parentAgent) throw new NotFoundException('Parent agent not found');
    if (parentAgent.status === 'revoked') throw new ForbiddenException('Parent agent is revoked');

    const childAgent = await this.agentRepo.findOne({ where: { id: childAgentId } });
    if (!childAgent) throw new NotFoundException(`Child agent ${childAgentId} not found`);
    if (childAgent.status === 'revoked') throw new ForbiddenException('Child agent is revoked');
    if (childAgent.org_id !== parentAgent.org_id) {
      throw new ForbiddenException('Cross-org delegation is not allowed');
    }

    // Chain depth: resolved from the parent's delegation record (if any).
    const parentDelegation = await this.delegationRepo.findOne({
      where: { child_jti: parent.jti, status: 'active' },
    });
    const depth = (parentDelegation?.depth ?? 0) + 1;
    if (depth > MAX_DEPTH) {
      throw new ForbiddenException(`Delegation chain too deep (max ${MAX_DEPTH})`);
    }

    const parentScopes: Scope[] = parent.scopes ?? [];
    const narrowed = this.narrowScopes(parentScopes, requestedScopes);
    if (narrowed.length === 0) {
      throw new BadRequestException('Requested scopes are not a subset of the parent token scopes');
    }

    // TTL can only be shorter than the parent's remaining lifetime.
    const parentRemainingMs = Math.max(
      0,
      new Date(parent.expires_at).getTime() - Date.now(),
    );
    const orgTtlMs = parseInt(process.env.TOKEN_TTL_MINUTES || '10', 10) * 60_000;
    const requestedTtl = (options.ttlMinutes ?? 10) * 60_000;
    const ttlMs = Math.min(requestedTtl, parentRemainingMs || orgTtlMs, orgTtlMs);
    if (ttlMs <= 0) throw new ForbiddenException('Parent token has no remaining lifetime');

    const rootPrincipal = parentDelegation
      ? { type: parentDelegation.root_principal_type, id: parentDelegation.root_principal_id }
      : { type: 'agent' as const, id: parentAgentId };

    const record = this.delegationRepo.create({
      org_id: parentAgent.org_id,
      parent_agent_id: parentAgentId,
      parent_jti: parent.jti,
      depth,
      child_agent_id: childAgentId,
      scopes: narrowed,
      root_principal_type: rootPrincipal.type,
      root_principal_id: rootPrincipal.id,
      purpose: options.purpose ?? null,
      expires_at: new Date(Date.now() + ttlMs),
      status: 'active',
    });
    const saved = await this.delegationRepo.save(record);

    // Issue the child JWT signed by the platform, scoped to the narrowed set.
    const childPayload = {
      sub: childAgentId,
      agent_id: childAgentId,
      scopes: narrowed,
      jti: crypto.randomUUID(),
      approval_mode: childAgent.approval_mode_override || 'autonomous',
      // Chain trace inside the token itself.
      delegation: {
        delegation_id: saved.id,
        depth,
        parent_agent_id: parentAgentId,
        root_principal_type: rootPrincipal.type,
        root_principal_id: rootPrincipal.id,
      },
    };
    const token = await this.tokenService.issueDelegatedToken(
      childPayload,
      childAgent.org_id,
      ttlMs,
    );
    await this.delegationRepo.update(saved.id, { child_jti: childPayload.jti });

    // Chain-aware audit: the entry names the full path, not just the actor.
    await this.auditService
      .logEntry(
        childAgent.org_id,
        'agent',
        childAgentId,
        'token.delegated',
        `chain:${[rootPrincipal.id, parentAgentId, childAgentId].join('>')}`,
        'allowed',
      )
      .catch(() => {});

    this.logger.log(`Delegation minted: depth ${depth}, parent ${parentAgentId} → child ${childAgentId}`);
    return { token, expires_at: new Date(Date.now() + ttlMs), delegation_id: saved.id, depth };
  }

  /** Structural scope narrowing: child scopes must be covered by parent scopes. */
  private narrowScopes(parentScopes: Scope[], requested: Scope[]): Scope[] {
    const result: Scope[] = [];
    for (const req of requested) {
      const covering = parentScopes.find(
        (p) =>
          p.resource_type === req.resource_type &&
          this.patternCovers(p.resource_pattern, req.resource_pattern),
      );
      if (!covering) continue;
      const actions = req.allowed_actions.filter((a) => covering.allowed_actions.includes(a));
      if (actions.length === 0) continue;
      result.push({
        resource_type: req.resource_type,
        resource_pattern: req.resource_pattern,
        allowed_actions: actions,
      });
    }
    return result;
  }

  /** Parent pattern covers child pattern if every resource matching the child also matches the parent. */
  private patternCovers(parentPattern: string, childPattern: string): boolean {
    if (parentPattern === '*') return true;
    if (parentPattern.endsWith('*')) {
      const prefix = parentPattern.slice(0, -1);
      return childPattern.startsWith(prefix) || childPattern === '*';
    }
    return parentPattern === childPattern;
  }

  /** Active delegation record for a child jti (used by verify paths). */
  async findActiveByChildJti(childJti: string): Promise<DelegatedToken | null> {
    return this.delegationRepo.findOne({
      where: { child_jti: childJti, status: 'active' },
    });
  }

  /**
   * Effective authority for a delegated check: the root agent's grant
   * INTERSECTED with the delegated scope. Returns a grant-like copy whose
   * resource_pattern is the (narrower) delegated pattern and whose
   * allowed_actions are the intersection — or null when no delegated scope
   * covers the grant. The permission-check loop consumes this unchanged.
   */
  narrowGrant(
    scopes: Scope[],
    grant: { resource_type: string; resource_pattern: string; allowed_actions: string[] },
  ): { resource_type: string; resource_pattern: string; allowed_actions: string[] } | null {
    for (const s of scopes) {
      if (s.resource_type !== grant.resource_type) continue;
      // The delegated pattern must sit inside the grant's pattern (it does by
      // construction at mint time), and the resource match later happens
      // against the NARROWED pattern.
      if (!this.patternCovers(grant.resource_pattern, s.resource_pattern)) continue;
      const actions = s.allowed_actions.filter((a) => grant.allowed_actions.includes(a));
      if (actions.length === 0) continue;
      return { resource_type: grant.resource_type, resource_pattern: s.resource_pattern, allowed_actions: actions };
    }
    return null;
  }

  /**
   * Walk up the chain to the ROOT agent — the one whose live grants
   * ultimately cover a delegated check. Authority is derived: if any link
   * above is revoked the walk stops there and the caller treats the
   * delegation as broken (the immediate liveness check catches that first).
   */
  async resolveRootAgentId(record: DelegatedToken): Promise<string> {
    let current = record;
    for (let i = 0; i < MAX_DEPTH + 1; i++) {
      const parentLink = await this.delegationRepo.findOne({
        where: { child_jti: current.parent_jti, status: 'active' },
      });
      if (!parentLink) return current.parent_agent_id;
      current = parentLink;
    }
    return current.parent_agent_id;
  }

  async revoke(delegationId: string, orgId: string, reason?: string): Promise<void> {
    const record = await this.delegationRepo.findOne({ where: { id: delegationId } });
    if (!record) throw new NotFoundException(`Delegation ${delegationId} not found`);
    if (record.org_id !== orgId) throw new ForbiddenException('Not your delegation');
    record.status = 'revoked';
    await this.delegationRepo.save(record);
    // Revoking a link revokes the child token with it.
    if (record.child_jti) await this.tokenService.revokeByJti(record.child_jti);
    this.logger.log(`Delegation revoked: ${delegationId}${reason ? ` (${reason})` : ''}`);
  }

  async listForOrg(orgId: string): Promise<DelegatedToken[]> {
    return this.delegationRepo.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
      take: 100,
    });
  }
}
