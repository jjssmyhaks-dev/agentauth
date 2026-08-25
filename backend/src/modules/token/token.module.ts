import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TokenIssued, Grant } from '../../database/entities';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenIssued, Grant]),
    JwtModule.register({
      global: true,
      signOptions: { algorithm: 'RS256' },
    }),
    IdentityModule,
  ],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
