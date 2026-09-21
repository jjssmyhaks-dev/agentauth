import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from '../../database/entities';

export type OrgRole = 'admin' | 'operator' | 'auditor';

export interface AuthContext {
  org_id: string;
  api_key_id: string;
  role: OrgRole;
  name: string;
}

/** Roles authorized for mutating control-plane calls. Auditors are read-only. */
const MUTATING_ROLES: OrgRole[] = ['admin', 'operator'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepo: Repository<ApiKey>,
  ) {}

  private static hash(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
  }

  /** Create a key; the raw value is returned exactly once. */
  async createKey(orgId: string, name: string, role: OrgRole = 'operator'): Promise<{
    id: string;
    name: string;
    role: OrgRole;
    prefix: string;
    key: string;
    created_at: Date;
    message: string;
  }> {
    const raw = `ak_${crypto.randomBytes(24).toString('hex')}`;
    const entity = this.apiKeyRepo.create({
      org_id: orgId,
      name,
      role,
      prefix: raw.substring(0, 12),
      key_hash: AuthService.hash(raw),
      status: 'active',
    });
    const saved = await this.apiKeyRepo.save(entity);
    this.logger.log(`API key created: ${name} (org ${orgId}, role ${role})`);
    return {
      id: saved.id,
      name: saved.name,
      role: saved.role,
      prefix: saved.prefix,
      key: raw,
      created_at: saved.created_at,
      message: 'Store this key securely — it will not be shown again.',
    };
  }

  /**
   * Authenticate a raw bearer key → org + role. Constant-time hash compare
   * via the DB lookup by hash; unknown keys fail with the same error shape
   * as revoked ones.
   */
  async authenticate(rawKey: string): Promise<AuthContext> {
    if (!rawKey || !rawKey.startsWith('ak_')) {
      throw new UnauthorizedException('Missing or malformed API key');
    }
    const entity = await this.apiKeyRepo.findOne({
      where: { key_hash: AuthService.hash(rawKey), status: 'active' },
    });
    if (!entity) throw new UnauthorizedException('Invalid API key');

    // Best-effort last-used stamp; never blocks the request.
    this.apiKeyRepo
      .update(entity.id, { last_used_at: new Date() })
      .catch(() => {});

    return {
      org_id: entity.org_id,
      api_key_id: entity.id,
      role: entity.role,
      name: entity.name,
    };
  }

  /**
   * Idempotently ensure the key named in BOOTSTRAP_API_KEY exists for the
   * demo/bootstrap org. Ops/CI bring-up: the API requires an existing key to
   * create keys, so the very first key must come from outside the API. The
   * raw value lives only in the secrets store; its hash is stored here.
   */
  async ensureBootstrapKey(orgId: string): Promise<void> {
    const raw = process.env.BOOTSTRAP_API_KEY;
    if (!raw || !raw.startsWith('ak_')) return;
    const role = (process.env.BOOTSTRAP_API_KEY_ROLE as OrgRole) || 'admin';
    try {
      const existing = await this.apiKeyRepo.findOne({
        where: { key_hash: AuthService.hash(raw), status: 'active' },
      });
      if (existing) return;
      await this.apiKeyRepo.save(
        this.apiKeyRepo.create({
          org_id: orgId,
          name: 'bootstrap',
          role,
          prefix: raw.slice(0, 12),
          key_hash: AuthService.hash(raw),
          status: 'active',
        }),
      );
      this.logger.log(`Bootstrap API key ensured (org ${orgId}, role ${role})`);
    } catch (err) {
      this.logger.warn(`ensureBootstrapKey skipped: ${err}`);
    }
  }

  async listKeys(orgId: string): Promise<Array<Record<string, any>>> {
    const rows = await this.apiKeyRepo.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
    });
    return rows.map((k) => ({
      id: k.id,
      name: k.name,
      role: k.role,
      prefix: k.prefix,
      status: k.status,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    }));
  }

  async revokeKey(orgId: string, id: string): Promise<void> {
    const key = await this.apiKeyRepo.findOne({ where: { id, org_id: orgId } });
    if (!key) throw new BadRequestException(`API key ${id} not found`);
    key.status = 'revoked';
    await this.apiKeyRepo.save(key);
    this.logger.log(`API key revoked: ${id}`);
  }

  /** Whether a role may perform mutating (non-GET) control-plane calls. */
  static canMutate(role: OrgRole): boolean {
    return MUTATING_ROLES.includes(role);
  }
}
