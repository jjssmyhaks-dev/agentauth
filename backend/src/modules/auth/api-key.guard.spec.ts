import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthService, AuthContext } from './auth.service';
import { ApiKeyGuard, AUTH_REQUEST_KEY } from './api-key.guard';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authenticate: jest.Mock;
  let verifyToken: jest.Mock;
  let findAgent: jest.Mock;
  const auth: AuthContext = { org_id: 'org-1', api_key_id: 'key-1', role: 'operator', name: 'ci' };

  function makeContext(method: string, headers: Record<string, string> = {}, url = '/v1/x') {
    const request: any = { method, headers, url, [AUTH_REQUEST_KEY]: undefined };
    const handler = function handlerFn() {};
    // Guard checks metadata on the handler and class — none set means guarded.
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => class Controller {},
    } as any;
  }

  beforeEach(async () => {
    // Mirror the real service: empty/malformed input is rejected by the
    // service itself, before the guard's role check.
    authenticate = jest.fn((raw: string) =>
      raw && raw.startsWith('ak_') ? Promise.resolve(auth) : Promise.reject(new UnauthorizedException('Missing or malformed API key')),
    );
    verifyToken = jest.fn(async () => ({ valid: false }));
    findAgent = jest.fn(async () => null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: AuthService, useValue: { authenticate } },
        { provide: TokenService, useValue: { verifyToken } },
        { provide: IdentityService, useValue: { findOne: findAgent } },
        { provide: ModuleRef, useValue: { get: (ref: unknown) => (ref === TokenService ? { verifyToken } : { findOne: findAgent }) } },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);
  });

  it('attaches the auth context when a valid bearer key resolves', async () => {
    authenticate.mockResolvedValue(auth);
    const ctx = makeContext('GET', { authorization: 'Bearer ak_abc' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest()[AUTH_REQUEST_KEY]).toEqual(auth);
  });

  it('rejects missing and malformed credentials', async () => {
    await expect(guard.canActivate(makeContext('GET'))).rejects.toThrow(UnauthorizedException);
    await expect(
      guard.canActivate(makeContext('GET', { authorization: 'Basic abc' })),
    ).rejects.toThrow(UnauthorizedException);
    authenticate.mockRejectedValue(new UnauthorizedException('Invalid API key'));
    await expect(
      guard.canActivate(makeContext('GET', { authorization: 'Bearer ak_x' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects read-only roles on mutating verbs', async () => {
    authenticate.mockResolvedValue({ ...auth, role: 'auditor' });
    await expect(
      guard.canActivate(makeContext('POST', { authorization: 'Bearer ak_a' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard.canActivate(makeContext('DELETE', { authorization: 'Bearer ak_a' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows read-only roles on GET', async () => {
    authenticate.mockResolvedValue({ ...auth, role: 'auditor' });
    await expect(guard.canActivate(makeContext('GET', { authorization: 'Bearer ak_a' }))).resolves.toBe(true);
  });

  it('allows operators and admins to mutate', async () => {
    authenticate.mockResolvedValue({ ...auth, role: 'admin' });
    await expect(guard.canActivate(makeContext('POST', { authorization: 'Bearer ak_a' }))).resolves.toBe(true);
    authenticate.mockResolvedValue({ ...auth, role: 'operator' });
    await expect(guard.canActivate(makeContext('PUT', { authorization: 'Bearer ak_a' }))).resolves.toBe(true);
  });

  it('accepts a valid agent JWT with role "agent" and org from the agent record', async () => {
    verifyToken.mockResolvedValue({ valid: true, agent_id: 'agent-9', jti: 'j-1' });
    findAgent.mockResolvedValue({ id: 'agent-9', org_id: 'org-1', name: 'payments-bot', status: 'active' });
    const ctx = makeContext('GET', { authorization: 'Bearer aaa.bbb.ccc' }, '/v1/treasury/mandates');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest()[AUTH_REQUEST_KEY]).toMatchObject({
      org_id: 'org-1', role: 'agent', agent_id: 'agent-9',
    });
  });

  it('rejects an invalid or expired agent JWT', async () => {
    verifyToken.mockResolvedValue({ valid: false });
    await expect(
      guard.canActivate(makeContext('GET', { authorization: 'Bearer bad.token.here' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a JWT whose agent is unknown or revoked', async () => {
    verifyToken.mockResolvedValue({ valid: true, agent_id: 'agent-x' });
    findAgent.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext('GET', { authorization: 'Bearer aaa.bbb.ccc' })),
    ).rejects.toThrow(UnauthorizedException);
    findAgent.mockResolvedValue({ id: 'agent-x', org_id: 'org-1', name: 'r', status: 'revoked' });
    await expect(
      guard.canActivate(makeContext('GET', { authorization: 'Bearer aaa.bbb.ccc' })),
    ).rejects.toThrow('revoked');
  });

  it('agent JWTs can POST only to treasury payment endpoints', async () => {
    verifyToken.mockResolvedValue({ valid: true, agent_id: 'agent-9', jti: 'j-1' });
    findAgent.mockResolvedValue({ id: 'agent-9', org_id: 'org-1', name: 'payments-bot', status: 'active' });
    // Treasury payment authorize → allowed (self-scoped path).
    await expect(
      guard.canActivate(makeContext('POST', { authorization: 'Bearer aaa.bbb.ccc' }, '/api/v1/treasury/payments/authorize')),
    ).resolves.toBe(true);
    // Any other mutating path → forbidden.
    await expect(
      guard.canActivate(makeContext('POST', { authorization: 'Bearer aaa.bbb.ccc' }, '/api/v1/treasury/policies')),
    ).rejects.toThrow(ForbiddenException);
  });
});
