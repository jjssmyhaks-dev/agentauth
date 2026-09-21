import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentFingerprint } from '../../database/entities';
import { FingerprintsService } from './fingerprints.service';
import { FingerprintsController } from './fingerprints.controller';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnvironmentFingerprint]), PoliciesModule],
  controllers: [FingerprintsController],
  providers: [FingerprintsService],
  exports: [FingerprintsService],
})
export class FingerprintsModule {}
