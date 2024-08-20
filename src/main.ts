import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('OrdersMS-Main');

  const app = await NestFactory.create(AppModule);
  await app.listen(envs.port);

  logger.log(`OrdersMS is running on port ${envs.port}`);
}
bootstrap();
