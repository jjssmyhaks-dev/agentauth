import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grant } from '../../database/entities';
import { GrantsService } from './grants.service';
import { GrantsController } from './grants.controller';
import { TokenModule } from '../token/token.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grant]),
    TokenModule,
    IdentityModule,
  ],
  controllers: [GrantsController],
  providers: [GrantsService],
  exports: [GrantsService],
})
export class GrantsModule {}
