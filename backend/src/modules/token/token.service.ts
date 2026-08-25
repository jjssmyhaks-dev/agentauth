import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Agent, TokenIssued, Grant } from '../../database/entities';
import { IdentityService } from '../identity/identity.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  // Server-side RSA key pair for JWT signing
  private privateKey: string;
  private publicKey: string;
  private keyId = 'agentauth-key-1';

  constructor(
    @InjectRepository(TokenIssued)
    private tokenRepo: Repository<TokenIssued>,
    @InjectRepository(Grant)
    private grantRepo: Repository<Grant>,
    private jwtService: JwtService,
    private identityService: IdentityService,
    private redis: RedisService,
  ) {
    // Generate or load RSA key pair for JWT signing
    const envPrivKey = process.env.JWT_PRIVATE_KEY;
    const envPubKey = process.env.JWT_PUBLIC_KEY;
    if (envPrivKey && envPubKey) {
      this.privateKey = envPrivKey;
      this.publicKey = envPubKey;
    } else {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.logger.warn('Generated ephemeral RSA key pair — set JWT_PRIVATE_KEY/JWT_PUBLIC_KEY for persistence');
    }
    // Configure JwtService to use our private key
    (this.jwtService as any).options = {
      ...(this.jwtService as any).options,
      signOptions: { algorithm: 'RS256', expiresIn: '10m' },
    };
  }

  async generateNonce(agentId: string): Promise<{ nonce: string; expires_at: Date }> {
    const agent = await this.identityService.findOne(agentId);
    if (agent.status === 'revoked') throw new BadRequestException('Agent is revoked');

    const nonce = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60000);

    // Store nonce in Redis (or in-memory fallback) instead of Map
    await this.redis.setNonce(nonce, agentId, 60);

    return { nonce, expires_at: expiresAt };
  }

  async issueToken(
    agentId: string,
    signedChallenge: string,
    challengeNonce: string,
  ): Promise<{ token: string; expires_at: Date; scopes: any[] }> {
    // Verify nonce from Redis
    const storedAgentId = await this.redis.getNonce(challengeNonce);
    if (!storedAgentId) throw new UnauthorizedException('Invalid or expired nonce');
    if (storedAgentId !== agentId) throw new UnauthorizedException('Nonce does not match agent');

    // Delete used nonce (one-time use)
    await this.redis.deleteNonce(challengeNonce);

    // Verify agent
    const agent = await this.identityService.findOne(agentId);
    if (agent.status === 'revoked') throw new UnauthorizedException('Agent is revoked');

    // Verify the signed challenge using agent's public key
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(challengeNonce);
      const isValid = verify.verify(agent.public_key, signedChallenge, 'base64');
      if (!isValid) throw new Error('Signature invalid');
    } catch {
      throw new UnauthorizedException('Invalid challenge signature');
    }

    // Get active grants for scopes
    const grants = await this.grantRepo.find({
      where: { agent_id: agentId, status: 'active' },
    });
    const scopes = grants.map((g) => ({
      resource_type: g.resource_type,
      resource_pattern: g.resource_pattern,
      allowed_actions: g.allowed_actions,
      grant_id: g.id,
    }));

    // Determine token TTL from org settings (default 10 min)
    const ttlMinutes = parseInt(process.env.TOKEN_TTL_MINUTES || '10', 10);
    const ttlSeconds = ttlMinutes * 60;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Generate JWT signed with our RSA private key
    const jti = uuidv4();
    const payload = {
      sub: agentId,
      agent_id: agentId,
      scopes,
      jti,
      approval_mode: agent.approval_mode_override || 'autonomous',
    };

    const token = this.jwtService.sign(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn: `${ttlMinutes}m`,
    });

    // Store token record
    await this.tokenRepo.save({
      agent_id: agentId,
      jti,
      expires_at: expiresAt,
      scopes_snapshot: scopes,
    });

    this.logger.log(`Token issued for agent ${agentId}, jti: ${jti}`);
    return { token, expires_at: expiresAt, scopes };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
      });
      return {
        valid: true,
        agent_id: payload.agent_id,
        scopes: payload.scopes,
        jti: payload.jti,
        approval_mode: payload.approval_mode,
        expires_at: new Date(payload.exp * 1000),
      };
    } catch (error) {
      return { valid: false, reason: 'Invalid or expired token' };
    }
  }

  getJwks(): any {
    // Return real public key in JWKS format
    const jwk = crypto.createPublicKey(this.publicKey).export({ format: 'jwk' });
    return {
      keys: [
        {
          ...jwk,
          kid: this.keyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  }
}
