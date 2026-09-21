import { Controller, Get, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { AppService } from './app.service';
import { TokenService } from './modules/token/token.service';
import { IsString, IsArray, IsOptional } from 'class-validator';

class CreateApiKeyDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ type: [String], default: ['read'] }) @IsArray() scopes: string[];
}

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    const dbOk = await this.appService.checkDatabase();
    // Make sure the org the dashboard bootstraps with exists (no-op when it
    // already does, and never fails the health check if seeding fails).
    await this.appService.ensureDefaultOrg(process.env.DEFAULT_ORG_ID || '00000000-0000-4000-8000-000000000001');
    return {
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'up' : 'down',
        version: '0.1.0',
      },
    };
  }

  @Get('.well-known/jwks.json')
  @ApiOperation({ summary: 'JWKS public keys for token verification' })
  getJwks() {
    return this.tokenService.getJwks();
  }

  // ── API Key Management ──
  @Post('v1/api-keys')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an API key for developer access' })
  async createApiKey(@Body() dto: CreateApiKeyDto, @Headers('x-org-id') orgId: string) {
    return this.appService.createApiKey(orgId, dto.name, dto.scopes);
  }

  @Get('v1/api-keys')
  @ApiOperation({ summary: 'List API keys for an org' })
  async listApiKeys(@Headers('x-org-id') orgId: string) {
    return this.appService.listApiKeys(orgId);
  }
}
