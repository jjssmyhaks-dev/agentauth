import { Injectable, UnauthorizedException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Agent, TokenIssued, Grant, AgentUsage } from '../../database/entities';
import { IdentityService } from '../identity/identity.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class TokenService implements OnModuleInit {
  private readonly logger = new Logger(TokenService.name);

  // ── Signing key ring ─────────────────────────────────────────────────
  // Priority: JWT_PRIVATE_KEY/JWT_PUBLIC_KEY env (ops-managed) → key pair
  // persisted in Redis (survives restarts, shared across instances) →
  // ephemeral (last resort). The previous key stays in the JWKS during
  // rotation so outstanding JWTs keep verifying until they expire.
  private activeKeyId = 'agentauth-key-1';
  private activePrivateKey: string;
  private activePublicKey: string;
  private previousKeyId: string | null = null;
  private previousPublicKey: string | null = null;

  private static readonly ACTIVE_KEY_REDIS = 'jwt:signing-key:active';
  private static readonly PREVIOUS_KEY_REDIS = 'jwt:signing-key:previous';

  constructor(
    @InjectRepository(TokenIssued)
    private tokenRepo: Repository<TokenIssued>,
    @InjectRepository(Grant)
    private grantRepo: Repository<Grant>,
    private jwtService: JwtService,
    private identityService: IdentityService,
    private redis: RedisService,
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    @InjectRepository(AgentUsage)
    private usageRepo: Repository<AgentUsage>,
  ) {
    const envPrivKey = process.env.JWT_PRIVATE_KEY;
    const envPubKey = process.env.JWT_PUBLIC_KEY;
    if (envPrivKey && envPubKey) {
      this.activePrivateKey = envPrivKey;
      this.activePublicKey = envPubKey;
      this.activeKeyId = process.env.JWT_KEY_ID || TokenService.deriveKeyId(envPubKey);
      // Ops-supplied previous key keeps verification working across rotations.
      this.previousPublicKey = process.env.JWT_PREVIOUS_PUBLIC_KEY || null;
      this.previousKeyId = this.previousPublicKey ? TokenService.deriveKeyId(this.previousPublicKey) : null;
    } else {
      const pair = TokenService.generateKeyPair();
      this.activePrivateKey = pair.privateKey;
      this.activePublicKey = pair.publicKey;
    }
    // Configure JwtService to use our private key
    (this.jwtService as any).options = {
      ...(this.jwtService as any).options,
      signOptions: { algorithm: 'RS256', expiresIn: '10m' },
    };
  }

  /** Load the persisted key pair (or persist the fresh one) after DI. */
  async onModuleInit(): Promise<void> {
    if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
      this.logger.log(`Using env-provided JWT signing keys (kid: ${this.activeKeyId})`);
      return;
    }
    try {
      const persisted = await this.redis.get(TokenService.ACTIVE_KEY_REDIS);
      if (persisted) {
        const stored = JSON.parse(persisted) as { kid: string; privateKey: string; publicKey: string };
        if (stored.privateKey && stored.publicKey) {
          this.activeKeyId = stored.kid;
          this.activePrivateKey = stored.privateKey;
          this.activePublicKey = stored.publicKey;
          this.logger.log(`Loaded persisted JWT signing key (kid: ${stored.kid})`);
          return;
        }
      }
      // No persisted key: store the freshly generated pair so restarts and
      // sibling instances reuse it instead of silently invalidating tokens.
      await this.redis.set(
        TokenService.ACTIVE_KEY_REDIS,
        JSON.stringify({ kid: this.activeKeyId, privateKey: this.activePrivateKey, publicKey: this.activePublicKey }),
      );
      this.logger.warn(
        'Generated JWT signing key pair — persisted to Redis for reuse. Set JWT_PRIVATE_KEY/JWT_PUBLIC_KEY for ops-managed keys.',
      );
    } catch (err) {
      this.logger.warn(`JWT key persistence unavailable — using ephemeral keys (${err})`);
    }
  }

  private static generateKeyPair(): { privateKey: string; publicKey: string } {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
  }

  private static deriveKeyId(publicKeyPem: string): string {
    return crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
  }

  /**
   * Rotate the signing key: the current key moves to "previous" (kept in the
   * JWKS so outstanding JWTs verify until they expire), a fresh key becomes
   * active, and both are persisted. Call from an ops/admin surface — never
   * expose it unauthenticated.
   */
  async rotateKeys(): Promise<{ activeKid: string; previousKid: string | null }> {
    if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
      throw new BadRequestException(
        'Keys are managed via JWT_PRIVATE_KEY/JWT_PUBLIC_KEY env — rotate them in your secrets manager instead',
      );
    }
    const pair = TokenService.generateKeyPair();
    this.previousKeyId = this.activeKeyId;
    this.previousPublicKey = this.activePublicKey;
    this.activeKeyId = TokenService.deriveKeyId(pair.publicKey);
    this.activePrivateKey = pair.privateKey;
    this.activePublicKey = pair.publicKey;
    try {
      await this.redis.set(TokenService.ACTIVE_KEY_REDIS, JSON.stringify({ kid: this.activeKeyId, privateKey: this.activePrivateKey, publicKey: this.activePublicKey }));
      if (this.previousPublicKey) {
        await this.redis.set(TokenService.PREVIOUS_KEY_REDIS, JSON.stringify({ kid: this.previousKeyId, publicKey: this.previousPublicKey }));
      }
    } catch (err) {
      this.logger.warn(`Rotated keys could not be persisted — they will be lost on restart (${err})`);
    }
    this.logger.log(`JWT signing key rotated (new kid: ${this.activeKeyId})`);
    return { activeKid: this.activeKeyId, previousKid: this.previousKeyId };
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

    const tokenStartTime = Date.now();

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
      privateKey: this.activePrivateKey,
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

    // Track latency (running average)
    try {
      const tokenLatency = Date.now() - tokenStartTime;
      await this.agentRepo.query(
        `UPDATE agents SET avg_latency_ms = CASE WHEN token_count > 0 THEN ((avg_latency_ms * (token_count - 1)) + $1) / token_count ELSE $1 END WHERE id = $2`,
        [tokenLatency, agentId],
      );
    } catch {}

    // Track token usage
    try {
      await this.agentRepo.update(agentId, {
        token_count: () => 'token_count + 1',
        last_active_at: new Date(),
      });

      // Upsert hourly usage bucket
      const hourBucket = new Date();
      hourBucket.setMinutes(0, 0, 0);
      const existingUsage = await this.usageRepo.findOne({
        where: { agent_id: agentId, hour_bucket: hourBucket },
      });
      if (existingUsage) {
        existingUsage.tokens_issued += 1;
        await this.usageRepo.save(existingUsage);
      } else {
        await this.usageRepo.save(this.usageRepo.create({
          agent_id: agentId,
          org_id: agent.org_id,
          hour_bucket: hourBucket,
          tokens_issued: 1,
        }));
      }
    } catch (err) {
      this.logger.warn(`Failed to track token usage: ${err}`);
    }

    return { token, expires_at: expiresAt, scopes };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token, {
        publicKey: this.activePublicKey,
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
    // Active key first; a previous key (kept after rotation) lets outstanding
    // JWTs verify until they naturally expire.
    const keys: any[] = [
      {
        ...crypto.createPublicKey(this.activePublicKey).export({ format: 'jwk' }),
        kid: this.activeKeyId,
        use: 'sig',
        alg: 'RS256',
      },
    ];
    if (this.previousPublicKey) {
      keys.push({
        ...crypto.createPublicKey(this.previousPublicKey).export({ format: 'jwk' }),
        kid: this.previousKeyId,
        use: 'sig',
        alg: 'RS256',
      });
    }
    return { keys };
  }
}
