import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, TokenIssued, Grant } from '../../database/entities';
import { IdentityService } from '../identity/identity.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(TokenIssued)
    private tokenRepository: Repository<TokenIssued>,
    @InjectRepository(Grant)
    private grantRepository: Repository<Grant>,
    private jwtService: JwtService,
    private identityService: IdentityService,
  ) {}

  private nonceStore = new Map<string, { nonce: string; expiresAt: Date; agentId: string }>();

  async generateNonce(agentId: string): Promise<{ nonce: string; expires_at: Date }> {
    const agent = await this.identityService.getAgent(agentId);
    if (agent.status === 'revoked') {
      throw new BadRequestException('Agent is revoked');
    }

    const nonce = crypto.randomBytes(32).toString('base64');
    const expiresAt = new Date(Date.now() + 60000); // 60 seconds

    this.nonceStore.set(nonce, { nonce, expiresAt, agentId });

    return { nonce, expires_at: expiresAt };
  }

  async issueToken(
    agentId: string,
    signedChallenge: string,
    challengeNonce: string,
  ): Promise<{ token: string; expires_at: Date; scopes: any[] }> {
    // Verify nonce
    const nonceData = this.nonceStore.get(challengeNonce);
    if (!nonceData || nonceData.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    if (nonceData.agentId !== agentId) {
      throw new UnauthorizedException('Nonce does not match agent');
    }

    // Delete used nonce
    this.nonceStore.delete(challengeNonce);

    // Verify agent exists and is active
    const agent = await this.identityService.getAgent(agentId);
    if (agent.status === 'revoked') {
      throw new UnauthorizedException('Agent is revoked');
    }

    // Get active grants for scopes
    const grants = await this.grantRepository.find({
      where: {
        agent_id: agentId,
        status: 'active',
      },
    });

    const scopes = grants.map((g) => ({
      resource_type: g.resource_type,
      resource_pattern: g.resource_pattern,
      allowed_actions: g.allowed_actions,
      grant_id: g.id,
    }));

    // Generate JWT
    const jti = uuidv4();
    const expiresIn = '10m'; // Default 10 minutes
    const payload = {
      agent_id: agentId,
      scopes,
      jti,
      approval_mode: agent.approval_mode_override || 'autonomous',
    };

    const token = this.jwtService.sign(payload, { expiresIn });

    // Store token record
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.tokenRepository.save({
      agent_id: agentId,
      jti,
      expires_at: expiresAt,
      scopes_snapshot: scopes,
    });

    return { token, expires_at: expiresAt, scopes };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      return {
        valid: true,
        agent_id: payload.agent_id,
        scopes: payload.scopes,
        expires_at: new Date(payload.exp * 1000),
      };
    } catch (error) {
      return { valid: false, reason: 'Invalid or expired token' };
    }
  }

  async getJwks(): Promise<any> {
    // Return public key in JWKS format
    const publicKey = process.env.JWT_PUBLIC_KEY || 'demo-public-key';
    return {
      keys: [
        {
          kty: 'RSA',
          kid: 'agentauth-key-1',
          use: 'sig',
          alg: 'RS256',
          n: publicKey,
          e: 'AQAB',
        },
      ],
    };
  }
}
