import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthService, OrgRole } from './auth.service';
import { ApiKeyGuard, AUTH_REQUEST_KEY } from './api-key.guard';

export class CreateApiKeyDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional({ enum: ['admin', 'operator', 'auditor'], default: 'operator' })
  @IsOptional() @IsIn(['admin', 'operator', 'auditor']) role?: OrgRole;
}

/** Key management. Creating and revoking keys requires an admin key. */
@ApiTags('Auth')
@ApiBearerAuth()
@Controller('v1/auth/api-keys')
@UseGuards(ApiKeyGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private org(request: any): string {
    return request[AUTH_REQUEST_KEY].org_id;
  }

  private requireAdmin(request: any): void {
    const auth = request[AUTH_REQUEST_KEY];
    if (auth.role !== 'admin') {
      throw new ForbiddenException('Only admin API keys can manage API keys');
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create an API key (admin only). The raw key is shown once.' })
  async create(@Req() request: any, @Body() dto: CreateApiKeyDto) {
    this.requireAdmin(request);
    return this.authService.createKey(this.org(request), dto.name, dto.role ?? 'operator');
  }

  @Get()
  @ApiOperation({ summary: 'List API keys for the authenticated org (never includes raw keys)' })
  async list(@Req() request: any) {
    return this.authService.listKeys(this.org(request));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key (admin only)' })
  async revoke(@Req() request: any, @Param('id') id: string) {
    this.requireAdmin(request);
    await this.authService.revokeKey(this.org(request), id);
    return { revoked: true };
  }
}
