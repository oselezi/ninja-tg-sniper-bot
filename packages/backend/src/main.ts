import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getBotName } from '@grammyjs/nestjs';

import { GCPCloudCustomLogger } from './logger/logger.service';
import { isGCP, isWebhookEnabled } from './util';
import { Logger } from '@nestjs/common';

import { WEBHOOK_URL } from './config/constants';

const logger = new Logger('Main');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new GCPCloudCustomLogger());

  const bot = app.get(getBotName());

  /** Starts the server */
  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);

  if (isWebhookEnabled) {
    console.log('Init via up webhook');

    if (isGCP) {
      console.log('Update webhook on bot running', WEBHOOK_URL);
      await bot.api.setWebhook(WEBHOOK_URL);
    }
  } else {
    console.warn('Init via polling');
  }

  if (isGCP) {
    process.once('SIGINT', () => {
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      bot.stop('SIGTERM');
    });
  }
}
bootstrap();
