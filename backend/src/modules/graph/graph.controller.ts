import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ApiTags('Graph')
@Controller('v1/graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @ApiOperation({ summary: 'Get identity graph as nodes and edges (scope=agent:{id} or resource:{type})' })
  async getGraph(
    @Query('scope') scope: string, // agent:{id} | resource:{type} | org:{id}
  ) {
    if (!scope) return { nodes: [], edges: [] };

    const [scopeType, ...scopeIdParts] = scope.split(':');
    const scopeId = scopeIdParts.join(':');

    return this.graphService.getGraph(scopeType, scopeId);
  }
}
