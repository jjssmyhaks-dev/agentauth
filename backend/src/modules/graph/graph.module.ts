import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent, Grant, Session, TrustScore, AgentAttribute } from '../../database/entities';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, Grant, Session, TrustScore, AgentAttribute])],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
