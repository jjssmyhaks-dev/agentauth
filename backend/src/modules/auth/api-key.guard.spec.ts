import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService, AuthContext } from './auth.service';
import { ApiKeyGuard, AUTH_REQUEST_KEY } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authenticate: jest.Mock;
  const auth: AuthContext = { org_id: 'org-1', api_key_id: 'key-1', role: 'operator', name: 'ci' };

  function makeContext(method: string, headers: Record<string, string> = {}) {
    const request: any = { method, headers, [AUTH_REQUEST_KEY]: undefined };
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: AuthService, useValue: { authenticate } },
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
});
