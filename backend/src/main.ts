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

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
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

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`AgentAuth backend running on port ${port}`);
  console.log(`API docs: http://0.0.0.0:${port}/docs`);
}
bootstrap();
