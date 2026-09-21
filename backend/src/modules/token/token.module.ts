import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TokenIssued, Grant, Agent, AgentUsage, DelegatedToken } from '../../database/entities';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { DelegationService } from './delegation.service';
import { DelegationController } from './delegation.controller';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenIssued, Grant, Agent, AgentUsage, DelegatedToken]),
    JwtModule.register({
      global: true,
      signOptions: { algorithm: 'RS256' },
    }),
    IdentityModule,
    AuditModule,
  ],
  controllers: [TokenController, DelegationController],
  providers: [TokenService, DelegationService],
  exports: [TokenService, DelegationService],
})
export class TokenModule {}
