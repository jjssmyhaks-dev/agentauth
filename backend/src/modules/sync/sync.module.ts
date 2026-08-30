import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncSource, SyncJob, Agent } from '../../database/entities';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [TypeOrmModule.forFeature([SyncSource, SyncJob, Agent]), IdentityModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
