import { Injectable, Logger } from '@nestjs/common';

import { InjectBot, Update, On } from '@grammyjs/nestjs';
import { Bot, Context as BotContext } from 'grammy';

import { InlineKeyboard } from 'grammy';

import { TokenEventTypeWithAi } from '../trade-notifications/types';

import { SINGLE_SLP_SCENE } from './constants';

const inlineKeyboard = (data) =>
  new InlineKeyboard()
    .url('Solscan', `https://solscan.io/address/${data.mint}`)
    .url('DEX Screener', `https://dexscreener.com/solana/${data.mint}`)
    .url('Birdeye', `https://birdeye.so/token/${data.mint}`)
    .row()
    .text(`Snipe $${data.symbol} on NINJA`, `SINGLE_${data.mint}`);

@Injectable()
@Update()
export class TelegramService {
  logger = new Logger(TelegramService.name);
  botId = 0;
  webhookUrl: string;
  constructor(
    @InjectBot()
    private readonly bot: Bot<BotContext>,
  ) {
    const WEBHOOK_PATH = process.env.WEBHOOK_PATH;
    const PUBLIC_URL = process.env.PUBLIC_URL;
    this.webhookUrl = `${PUBLIC_URL}${WEBHOOK_PATH}`;
  }

  async getBotId(): Promise<number> {
    if (this.botId != 0) {
      return this.botId;
    }
    this.botId = this.bot.botInfo.id;

    return this.botId;
  }

  async getMe() {
    return this.bot.api.getMe();
  }

  async setWebhook() {
    const res = await this.bot.api.setWebhook(this.webhookUrl);

    return res;
  }

  async dropUpdates() {
    return await this.bot.api.setWebhook(this.webhookUrl, {
      drop_pending_updates: true,
    });
  }

  async getWebhookInfo() {
    const res = await this.bot.api.getWebhookInfo();
    res.url = res.url.includes('https') ? '***' : 'POLLING';
    return res;
  }

  async sendNotification(chatId: string, data: TokenEventTypeWithAi) {
    try {
      console.log(
        `Sending message to chatId: ${chatId}, message: ${JSON.stringify(data)}`,
      );

      const html =
        `🥷 Snipe Triggered\n\n` +
        `<strong>$${data.symbol}</strong> / <a href="https://dexscreener.com/solana/${data.baseMint}">${data.name}</a>\n` +
        `/${data.baseMint}\n` +
        `${data?.aiReasoning} \n` +
        `🔥️ ${data.rating}%  🕑 A few seconds ago\n` +
        `<i>${data?.aiMessage}</i>`;

      const imageIsValid =
        data.image && data.image.length > 0 && isSupportImageFormat(data.image);

      if (imageIsValid) {
        await this.bot.api.sendPhoto(chatId, data.image, {
          caption: html,
          parse_mode: 'HTML',
          // reply_markup: inlineKeyboard(data),
        });
      } else {
        await this.bot.api.sendMessage(chatId, html, {
          parse_mode: 'HTML',
          // reply_markup: inlineKeyboard(data),
          link_preview_options: {
            is_disabled: true,
          },
        });
      }
    } catch (e) {
      this.logger.error(e, 'MESSAGE_ERROR');
      // TODO remove chatId from db
    }
  }

  @On('callback_query')
  async action(ctx: any, next) {
    console.log('callback_query', ctx.callbackQuery.data);
    const callbackQuery = ctx.callbackQuery.data;
    if (!callbackQuery?.includes('SINGLE_')) {
      return next();
    }

    // @ts-ignore
    const data = ctx?.update?.callback_query?.data.split('_');
    if (data[0] === 'SINGLE') {
      await ctx.scenes.enter(SINGLE_SLP_SCENE, {
        token: data[1],
        isSniping: true,
      });

      return;
    }
  }
}

const isSupportImageFormat = (image: string) => {
  return image.includes('jpg') || image.includes('png');
};
