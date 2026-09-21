import { Controller, Get, Post, Body, Headers, HttpCode, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppService } from './app.service';
import { TokenService } from './modules/token/token.service';
import { AuthService } from './modules/auth/auth.service';
import { ApiKeyGuard, AUTH_REQUEST_KEY, PublicApi } from './modules/auth/api-key.guard';
import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';

class CreateApiKeyDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ type: [String], default: ['read'] }) @IsArray() @IsOptional() scopes: string[];
  @ApiPropertyOptional({ enum: ['admin', 'operator', 'auditor'] }) @IsOptional() @IsIn(['admin', 'operator', 'auditor']) role: string;
}

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  @PublicApi()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    const dbOk = await this.appService.checkDatabase();
    // Make sure the org the dashboard bootstraps with exists (no-op when it
    // already does, and never fails the health check if seeding fails).
    const defaultOrg = process.env.DEFAULT_ORG_ID || '00000000-0000-4000-8000-000000000001';
    await this.appService.ensureDefaultOrg(defaultOrg);
    // Break the first-key chicken-and-egg for ops/CI (idempotent, no-op
    // unless BOOTSTRAP_API_KEY is set).
    await this.authService.ensureBootstrapKey(defaultOrg).catch(() => {});
    return {
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'up' : 'down',
        version: '0.1.0',
      },
    };
  }

  @PublicApi()
  @Get('.well-known/jwks.json')
  @ApiOperation({ summary: 'JWKS public keys for token verification' })
  getJwks() {
    return this.tokenService.getJwks();
  }

  // ── API Key Management (legacy path kept for the dashboard client) ──
  @Post('v1/api-keys')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an API key (admin key required; org from the bearer key)' })
  async createApiKey(@Req() request: any, @Body() dto: CreateApiKeyDto) {
    const auth = request[AUTH_REQUEST_KEY];
    if (auth.role !== 'admin') {
      throw new ForbiddenException('Only admin API keys can manage API keys');
    }
    return this.authService.createKey(auth.org_id, dto.name, (dto.role as any) ?? 'operator');
  }

  @Get('v1/api-keys')
  @ApiOperation({ summary: 'List API keys for the authenticated org (no raw keys)' })
  async listApiKeys(@Req() request: any) {
    const auth = request[AUTH_REQUEST_KEY];
    return this.authService.listKeys(auth.org_id);
  }
}
