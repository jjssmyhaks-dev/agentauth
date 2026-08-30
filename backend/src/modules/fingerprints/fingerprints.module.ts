import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentFingerprint } from '../../database/entities';
import { FingerprintsService } from './fingerprints.service';
import { FingerprintsController } from './fingerprints.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EnvironmentFingerprint])],
  controllers: [FingerprintsController],
  providers: [FingerprintsService],
  exports: [FingerprintsService],
})
export class FingerprintsModule {}
