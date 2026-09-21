import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TokenService } from './token.service';
import { TokenRequestDto, TokenVerifyDto } from '../../common/dto';
import { PublicApi } from '../auth/api-key.guard';

@ApiTags('Tokens')
@Controller('v1/tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('challenge')
  @PublicApi()
  @ApiOperation({ summary: 'Get a nonce challenge for token exchange' })
  async getChallenge(@Query('agent_id') agentId: string) {
    return this.tokenService.generateNonce(agentId);
  }

  @Post()
  @PublicApi()
  @ApiOperation({ summary: 'Exchange signed challenge for JWT token' })
  async requestToken(@Body() dto: TokenRequestDto) {
    return this.tokenService.issueToken(dto.agent_id, dto.signed_challenge, dto.challenge_nonce);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify a JWT token' })
  async verifyToken(@Body() dto: TokenVerifyDto) {
    return this.tokenService.verifyToken(dto.token);
  }
}
