import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TokenService } from './token.service';
import { Agent, TokenIssued, Grant, AgentUsage } from '../../database/entities';
import { IdentityService } from '../identity/identity.service';
import { RedisService } from '../../common/redis/redis.service';

/**
 * Unit tests for the challenge-response token flow:
 * nonce lifecycle (one-time use, agent binding, revoked agents),
 * RS256 signature verification, scope building from grants,
 * and JWT verify + JWKS export.
 */
describe('TokenService', () => {
  let service: TokenService;

  const tokenRepo = { save: jest.fn().mockResolvedValue({}) };
  const grantRepo = { find: jest.fn().mockResolvedValue([]) };
  const agentRepo = {
    query: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  };
  const usageRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
    create: jest.fn((d: any) => d),
  };
  const identityService = { findOne: jest.fn() };
  const redis = {
    setNonce: jest.fn().mockResolvedValue(undefined),
    getNonce: jest.fn().mockResolvedValue(null),
    deleteNonce: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = {
    sign: jest.fn(() => 'signed.jwt.token'),
    verify: jest.fn(),
    options: {},
  };

  // Real RSA key pair so signature verification is exercised end-to-end.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const activeAgent = {
    id: 'agent-1',
    org_id: 'org-1',
    status: 'active',
    public_key: publicKey,
    approval_mode_override: null,
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(TokenIssued), useValue: tokenRepo },
        { provide: getRepositoryToken(Grant), useValue: grantRepo },
        { provide: getRepositoryToken(Agent), useValue: agentRepo },
        { provide: getRepositoryToken(AgentUsage), useValue: usageRepo },
        { provide: IdentityService, useValue: identityService },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('generateNonce', () => {
    it('stores a nonce in Redis bound to the agent', async () => {
      identityService.findOne.mockResolvedValue(activeAgent);

      const { nonce, expires_at } = await service.generateNonce('agent-1');

      expect(nonce).toBeDefined();
      expect(nonce.length).toBeGreaterThan(30);
      expect(expires_at.getTime()).toBeGreaterThan(Date.now());
      expect(redis.setNonce).toHaveBeenCalledWith(nonce, 'agent-1', 60);
    });

    it('rejects revoked agents', async () => {
      identityService.findOne.mockResolvedValue({ ...activeAgent, status: 'revoked' });

      await expect(service.generateNonce('agent-1')).rejects.toThrow(BadRequestException);
      expect(redis.setNonce).not.toHaveBeenCalled();
    });
  });

  describe('issueToken', () => {
    const nonce = 'test-nonce-123';

    function signChallenge(nonceValue: string, withKey = privateKey): string {
      const signer = crypto.createSign('SHA256');
      signer.update(nonceValue);
      return signer.sign(withKey, 'base64');
    }

    it('issues an RS256 token after verifying the signed challenge', async () => {
      redis.getNonce.mockResolvedValue('agent-1');
      identityService.findOne.mockResolvedValue(activeAgent);
      grantRepo.find.mockResolvedValue([
        {
          id: 'grant-1',
          resource_type: 'repository',
          resource_pattern: 'acme/*',
          allowed_actions: ['read', 'write'],
        },
      ]);

      const signature = signChallenge(nonce);
      const result = await service.issueToken('agent-1', signature, nonce);

      // Nonce is consumed exactly once
      expect(redis.deleteNonce).toHaveBeenCalledWith(nonce);
      // Signature was actually verified against the agent's public key
      expect(result.scopes).toEqual([
        {
          resource_type: 'repository',
          resource_pattern: 'acme/*',
          allowed_actions: ['read', 'write'],
          grant_id: 'grant-1',
        },
      ]);
      expect(result.expires_at.getTime()).toBeGreaterThan(Date.now());
      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: 'agent-1', jti: expect.any(String) }),
      );
      // RS256 JWT was signed with the server's private key
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'agent-1', agent_id: 'agent-1' }),
        expect.objectContaining({ algorithm: 'RS256' }),
      );
    });

    it('rejects a challenge signed with a different key', async () => {
      redis.getNonce.mockResolvedValue('agent-1');
      identityService.findOne.mockResolvedValue(activeAgent);

      const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      await expect(
        service.issueToken('agent-1', signChallenge(nonce, otherKey), nonce),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown nonce (never issued or expired)', async () => {
      redis.getNonce.mockResolvedValue(null);

      await expect(
        service.issueToken('agent-1', signChallenge(nonce), nonce),
      ).rejects.toThrow('Invalid or expired nonce');
    });

    it('rejects a nonce bound to a different agent', async () => {
      redis.getNonce.mockResolvedValue('agent-2');

      await expect(
        service.issueToken('agent-1', signChallenge(nonce), nonce),
      ).rejects.toThrow('Nonce does not match agent');
    });

    it('rejects revoked agents even with a valid challenge', async () => {
      redis.getNonce.mockResolvedValue('agent-1');
      identityService.findOne.mockResolvedValue({ ...activeAgent, status: 'revoked' });

      await expect(
        service.issueToken('agent-1', signChallenge(nonce), nonce),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyToken', () => {
    it('returns the payload for a valid token', async () => {
      jwtService.verify.mockReturnValue({
        agent_id: 'agent-1',
        scopes: [],
        jti: 'jti-1',
        approval_mode: 'autonomous',
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      const result = await service.verifyToken('good.token.here');

      expect(result.valid).toBe(true);
      expect(result.agent_id).toBe('agent-1');
      expect(result.jti).toBe('jti-1');
    });

    it('returns invalid for a tampered or expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await service.verifyToken('bad.token.here');

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('getJwks', () => {
    it('exposes the public key as a JWKS RSA signing key', () => {
      const jwks = service.getJwks();

      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0].kty).toBe('RSA');
      expect(jwks.keys[0].alg).toBe('RS256');
      expect(jwks.keys[0].use).toBe('sig');
      expect(jwks.keys[0].kid).toBe('agentauth-key-1');
      // A public JWKS must never contain private key material
      expect(jwks.keys[0].d).toBeUndefined();
      expect(jwks.keys[0].p).toBeUndefined();
    });
  });
});
