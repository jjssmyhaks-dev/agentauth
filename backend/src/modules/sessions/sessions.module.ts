import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../../database/entities';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), PoliciesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
