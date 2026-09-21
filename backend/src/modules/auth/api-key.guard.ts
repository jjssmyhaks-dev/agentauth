import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';

export const AUTH_REQUEST_KEY = 'auth';

/** AuthContext for an org API key or an agent JWT (PRD §12: agent-facing vs admin). */
export interface AuthContext {
  org_id: string;
  role: 'admin' | 'operator' | 'auditor' | 'agent';
  name: string;
  api_key_id?: string;
  /** Agent JWT path only. */
  agent_id?: string;
  token_jti?: string;
}

/**
 * Control-plane authentication + authorization.
 *
 * - `Authorization: Bearer ak_…` → org API key context (admin/operator/auditor).
 * - `Authorization: Bearer <agent JWT>` → agent context with role "agent":
 *   verified against the token service (RS256, rotation-aware), org resolved
 *   from the agent record — never from client input. Agent-scoped requests
 *   can only act for their own agent_id.
 * - Roles: agent/auditor are read-or-self-scoped; admin and operator may
 *   mutate the control plane (enforced below and in services).
 * - Endpoints decorated `@PublicApi()` bypass the guard (health, JWKS,
 *   token flows, docs).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  // TokenService/IdentityService resolve lazily via ModuleRef: TokenModule
  // imports IdentityModule which participates in the auth boundary, so direct
  // constructor injection would create a module-import cycle.
  private tokenService?: TokenService;
  private identityService?: IdentityService;

  constructor(
    private readonly authService: AuthService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private async lazyServices(): Promise<{ tokens: TokenService; identity: IdentityService }> {
    this.tokenService ??= this.moduleRef.get(TokenService, { strict: false });
    this.identityService ??= this.moduleRef.get(IdentityService, { strict: false });
    return { tokens: this.tokenService, identity: this.identityService };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const raw = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!raw) throw new UnauthorizedException('Missing or malformed API key');

    let auth: AuthContext;
    if (raw.startsWith('ak_')) {
      try {
        auth = await this.authService.authenticate(raw);
      } catch (err) {
        throw err instanceof UnauthorizedException ? err : new UnauthorizedException('Invalid API key');
      }
    } else if (raw.split('.').length === 3) {
      // Agent JWT (RS256, 3 segments). verifyToken checks signature + expiry
      // with key rotation; agent org is resolved from the DB below.
      const { tokens, identity } = await this.lazyServices();
      const verified = await tokens.verifyToken(raw);
      if (!verified?.valid) throw new UnauthorizedException('Invalid or expired agent token');
      const agent = await identity.findOne(verified.agent_id);
      if (!agent || agent.status === 'revoked') throw new UnauthorizedException('Agent is revoked or unknown');
      auth = {
        org_id: agent.org_id,
        role: 'agent',
        name: agent.name,
        agent_id: agent.id,
        token_jti: verified.jti,
      };
    } else {
      throw new UnauthorizedException('Missing or malformed API key');
    }

    request[AUTH_REQUEST_KEY] = auth;

    // Agent and auditor tokens can never mutate the control plane. Agent
    // payment flows (authorize/confirm) carry their own self-scoped checks in
    // the treasury service rather than blanket write access.
    const agentPaymentPath = request.url?.includes('/v1/treasury/payments');
    const mutatingRole = auth.role === 'admin' || auth.role === 'operator';
    if (!mutatingRole && request.method !== 'GET' && request.method !== 'HEAD' && !(auth.role === 'agent' && agentPaymentPath)) {
      throw new ForbiddenException(`Role "${auth.role}" is read-only`);
    }
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    const clazz = context.getClass();
    const handler = context.getHandler();
    // Health probe by path (no decorator needed; pre-auth bootstrap).
    const request = context.switchToHttp().getRequest();
    if (request.path?.includes('/health')) return true;
    // Handlers marked via metadata set by the @PublicApi decorator.
    const isPublic = Reflect.getMetadata(PUBLIC_API_KEY, handler) || Reflect.getMetadata(PUBLIC_API_KEY, clazz);
    return !!isPublic;
  }
}

export const PUBLIC_API_KEY = 'agentauth:public-api';

/** Mark an endpoint as bypassing ApiKeyGuard (health, JWKS, agent token flow). */
export const PublicApi = (): MethodDecorator & ClassDecorator =>
  ((target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor && descriptor.value) {
      Reflect.defineMetadata(PUBLIC_API_KEY, true, descriptor.value);
    } else if (target) {
      Reflect.defineMetadata(PUBLIC_API_KEY, true, target);
    }
  }) as MethodDecorator & ClassDecorator;
