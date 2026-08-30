import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssistantService, AssistantQuery } from './assistant.service';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssistantQueryDto {
  @ApiProperty({ description: 'Natural language question about agents, policies, audit logs, or how to use the platform' })
  @IsString()
  query: string;

  @ApiProperty() @IsUUID() org_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() user_id?: string;
}

@ApiTags('Assistant')
@Controller('v1/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('query')
  @ApiOperation({ summary: 'Ask the AI assistant about agent activity, policies, or how to use the platform' })
  async query(@Body() dto: AssistantQueryDto) {
    return this.assistantService.query({
      query: dto.query,
      org_id: dto.org_id,
      user_id: dto.user_id,
    });
  }
}
