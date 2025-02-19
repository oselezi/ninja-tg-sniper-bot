import { Controller } from '@nestjs/common';

import { Body, Get, Post } from '@nestjs/common';
import { InjectBot } from '@grammyjs/nestjs';
import { Bot, Context } from 'grammy';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    @InjectBot() private readonly bot: Bot<Context>,
    private readonly telegramService: TelegramService,
  ) {}

  @Get('')
  async get() {
    return this.telegramService.getMe();
  }

  @Get('webhook/status')
  async status() {
    return this.telegramService.getWebhookInfo();
  }

  @Get('webhook/set')
  async set() {
    return this.telegramService.setWebhook();
  }

  @Get('webhook/drop-updates')
  async dropUpdates() {
    return this.telegramService.dropUpdates();
  }

  @Post('webhook')
  async webhook(@Body() body: any) {
    // console.log(body);
    return 'ok';
  }
}
