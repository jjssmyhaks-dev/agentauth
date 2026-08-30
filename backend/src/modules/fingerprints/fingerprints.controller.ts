import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FingerprintsService } from './fingerprints.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterFingerprintDto {
  @ApiProperty() environment_info: Record<string, any>;
}

@ApiTags('Fingerprints')
@Controller('v1/agents/:agentId/fingerprints')
export class FingerprintsController {
  constructor(private readonly fingerprintsService: FingerprintsService) {}

  @Post()
  @ApiOperation({ summary: 'Register an environment fingerprint' })
  async register(@Param('agentId') agentId: string, @Body() dto: RegisterFingerprintDto) {
    return this.fingerprintsService.register(agentId, dto.environment_info);
  }

  @Get()
  @ApiOperation({ summary: 'List fingerprints for an agent' })
  async findAll(@Param('agentId') agentId: string) {
    return this.fingerprintsService.findAll(agentId);
  }

  @Post(':id/trust')
  @ApiOperation({ summary: 'Mark a fingerprint as trusted' })
  async trust(@Param('agentId') agentId: string, @Param('id') id: string) {
    return this.fingerprintsService.trust(id);
  }

  @Post(':id/untrust')
  @ApiOperation({ summary: 'Untrust a fingerprint' })
  async untrust(@Param('agentId') agentId: string, @Param('id') id: string) {
    return this.fingerprintsService.untrust(id);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify if an environment fingerprint is trusted' })
  async verify(@Param('agentId') agentId: string, @Body() dto: RegisterFingerprintDto) {
    return this.fingerprintsService.verify(agentId, dto.environment_info);
  }
}
