import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AgentAuth API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: ['.well-known/(.*)', 'health'] });
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /health', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBeDefined();
          expect(res.body.services).toBeDefined();
        });
    });
  });

  describe('JWKS', () => {
    it('GET /.well-known/jwks.json', () => {
      return request(app.getHttpServer())
        .get('/.well-known/jwks.json')
        .expect(200)
        .expect((res) => {
          expect(res.body.keys).toBeDefined();
          expect(res.body.keys.length).toBeGreaterThan(0);
          expect(res.body.keys[0].kid).toBeDefined();
        });
    });
  });

  describe('Agent Identity', () => {
    let agentId: string;

    it('POST /api/v1/agents — register agent', () => {
      return request(app.getHttpServer())
        .post('/api/v1/agents')
        .send({
          org_id: '00000000-0000-0000-0000-000000000001',
          name: 'test-agent',
          public_key: 'dGVzdC1wdWJsaWMta2V5', // base64
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.agent_id).toBeDefined();
          expect(res.body.status).toBe('active');
          agentId = res.body.agent_id;
        });
    });

    it('GET /api/v1/agents/:id — get agent', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/agents/${agentId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('test-agent');
        });
    });

    it('POST /api/v1/agents/:id/revoke — revoke agent', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/agents/${agentId}/revoke`)
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('revoked');
        });
    });
  });

  describe('Tokens', () => {
    let agentId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agents')
        .send({
          org_id: '00000000-0000-0000-0000-000000000001',
          name: 'token-test-agent',
          public_key: 'dGVzdC1wdWJsaWMta2V5',
        });
      agentId = res.body.agent_id;
    });

    it('GET /api/v1/tokens/challenge — get nonce', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/tokens/challenge?agent_id=${agentId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.nonce).toBeDefined();
          expect(res.body.expires_at).toBeDefined();
        });
    });
  });

  describe('Grants', () => {
    it('POST /api/v1/grants — create grant (rejects missing fields)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/grants')
        .send({})
        .expect(400); // Validation should reject
    });
  });

  describe('Swagger', () => {
    it('GET /docs — Swagger UI', () => {
      return request(app.getHttpServer())
        .get('/docs')
        .expect(200);
    });
  });
});
