import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../../database/entities';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './api-key.guard';
import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [AuthController],
  providers: [AuthService, ApiKeyGuard],
  exports: [AuthService, ApiKeyGuard],
})
export class AuthModule {}
