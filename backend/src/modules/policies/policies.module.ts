import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../../database/entities';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { PolicyEngineService } from './policy-engine.service';

@Module({
  imports: [TypeOrmModule.forFeature([Policy])],
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyEngineService],
  exports: [PoliciesService, PolicyEngineService],
})
export class PoliciesModule {}
