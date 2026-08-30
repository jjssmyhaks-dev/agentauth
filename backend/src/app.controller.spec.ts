import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TokenService } from './modules/token/token.service';
import { RedisService } from './common/redis/redis.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenIssued, Organization } from './database/entities';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: TokenService,
          useValue: { getJwks: jest.fn().mockReturnValue({ keys: [] }) },
        },
        {
          provide: getRepositoryToken(TokenIssued),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: { findOne: jest.fn(), save: jest.fn(), query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
        },
        {
          provide: RedisService,
          useValue: { isConnected: true, set: jest.fn(), get: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.health();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
