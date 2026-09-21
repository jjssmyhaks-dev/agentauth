import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

export const AUTH_REQUEST_KEY = 'auth';

/**
 * Control-plane authentication + authorization.
 *
 * - Resolves the `Authorization: Bearer ak_...` key to an AuthContext and
 *   attaches it to the request; downstream code reads `request.auth.org_id`
 *   INSTEAD of trusting any client-supplied org header/body field.
 * - Enforces roles: auditor keys are rejected on non-GET methods; admin and
 *   operator may mutate.
 * - Endpoints decorated `@PublicApi()` bypass the guard (health, JWKS,
 *   agent-facing token flows, docs).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const raw = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

    let auth: Awaited<ReturnType<AuthService['authenticate']>>;
    try {
      auth = await this.authService.authenticate(raw ?? '');
    } catch (err) {
      // Surface the reason (malformed vs invalid) but never leak key material.
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Invalid API key');
    }
    request[AUTH_REQUEST_KEY] = auth;

    if (request.method !== 'GET' && request.method !== 'HEAD' && !AuthService.canMutate(auth.role)) {
      throw new ForbiddenException(`Role "${auth.role}" is read-only`);
    }
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const clazz = context.getClass();
    // Handlers marked via metadata set by the @PublicApi decorator.
    const isPublic = Reflect.getMetadata(PUBLIC_API_KEY, handler) || Reflect.getMetadata(PUBLIC_API_KEY, clazz);
    return !!isPublic;
  }
}

export const PUBLIC_API_KEY = 'agentauth:public-api';

/** Mark an endpoint as bypassing ApiKeyGuard (health, JWKS, agent token flow). */
export const PublicApi = (): MethodDecorator & ClassDecorator =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(PUBLIC_API_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(PUBLIC_API_KEY, true, target);
    }
  };
