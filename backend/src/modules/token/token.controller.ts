import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TokenService } from './token.service';

@Controller('v1/tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('challenge')
  async getChallenge(@Query('agent_id') agentId: string) {
    return this.tokenService.generateNonce(agentId);
  }

  @Post()
  async requestToken(
    @Body() body: { agent_id: string; signed_challenge: string; challenge_nonce: string },
  ) {
    return this.tokenService.issueToken(
      body.agent_id,
      body.signed_challenge,
      body.challenge_nonce,
    );
  }

  @Post('verify')
  async verifyToken(@Body() body: { token: string }) {
    return this.tokenService.verifyToken(body.token);
  }
}
