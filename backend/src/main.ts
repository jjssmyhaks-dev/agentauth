import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Initialize Sentry
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global exception filter (prevents stack trace leaks)
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS — no wildcard default. An explicit CORS_ORIGIN is required in
  // production; in development the dashboard's default origins are allowed.
  // (The `*` default silently enabled any site to call the API with
  // credentials — the opposite of what an auth platform should do.)
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : isProd
      ? [] // empty list = deny all cross-origin (same-origin / non-browser clients still work)
      : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
  if (isProd && corsOrigin.length === 0) {
    console.warn('CORS_ORIGIN not set — cross-origin browser requests will be denied. Set CORS_ORIGIN to your dashboard origin(s).');
  }
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Validation pipe (whitelist strips unknown props, transform auto-casts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Routes: /api/v1/... for API, exclude .well-known
  app.setGlobalPrefix('api', {
    exclude: ['.well-known/(.*)', 'health'],
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('AgentAuth API')
    .setDescription('Identity, permissions, and audit platform for AI agents')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // `|| 4000` also recovers from PORT=0 / unparsable values leaking in from
  // the environment — an unset port should mean the documented default, not
  // an OS-assigned random one.
  const port = parseInt(process.env.PORT || '4000', 10) || 4000;
  await app.listen(port);
  console.log(`AgentAuth backend running on port ${port}`);
  console.log(`API docs: http://0.0.0.0:${port}/docs`);
}
bootstrap();
