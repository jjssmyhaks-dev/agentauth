import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustScore, TrustEvent, Agent } from '../../database/entities';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrustScore, TrustEvent, Agent]), PoliciesModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
