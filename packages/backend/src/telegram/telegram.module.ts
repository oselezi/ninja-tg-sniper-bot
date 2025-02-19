import { Module, Logger, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InjectBot } from '@grammyjs/nestjs';
import { Bot, Context, webhookCallback } from 'grammy';

import { hydrateReply } from '@grammyjs/parse-mode';

import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { AccountModule } from '../account/account.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { BlockchainMainModule } from '../blockchain-main/blockchain-main.module';
import { BlockchainQueueModule } from '@/blockchain-queue/blockchain-queue.module';
import { TradeNotificationsAnalysisModule } from '../trade-notifications-analysis/trade-notifications-analysis.module';

import { AnalyticsModule } from '../analytics/analytics.module';
import { DexScreenerModule } from '../dexscreener/dexscreener.module';

import { createConversation, conversations } from '@grammyjs/conversations';

import { WalletScene } from './scenes/wallet.scene';

import { SceneManagerService } from './scenes/library/scene-manager.service';

import { SingleSPLScene } from './scenes/spl-single.scene';
import { BuySLPScene } from './scenes/spl-buy.scene';
import { SolTransferScene } from './scenes/sol-transfer.scene';

import { XAmountSPLScene } from './scenes/spl-x-amount.scene';
import { TaxScene } from './scenes/tax.scene';
import { SenseiScene } from './scenes/sensei.scene';

import { NinjaModeScene } from './scenes/ninja-mode.scene';
import { ReferScene } from './scenes/refer.scene';
import { ChatScene } from './scenes/chat.scene';
import { SettingsScene } from './scenes/settings.scene';
import { PortfolioScene } from './scenes/portfolio.scene';
import { WaitListScene } from './scenes/waitlist.scene';
import { SellSLPScene } from './scenes/spl-sell.scene';

import { NinjaModeNewsScene } from './scenes/ninja-mode-news.scene';
import { KamikazeScene } from './scenes/kamikaze.scene';
import { SceneLoaderService } from './scenes/library/scene-loader.service';
import { backToDojoKeyboardMenu, exitNinjaKeyboard } from './common/keyboards';
import { BASE_COMMANDS } from './common/commands';
import { BotBackupScene } from './scenes/bot-backup.scene';
import { ActivityScene } from './scenes/activity.scene';
import { TopupScene } from './scenes/topup.scene';
import { BlockchainEVMModule } from '../blockchain-evm/blockchain-evm.module';
import { BirdEyeModule } from '../birdeye/birdeye.module';
import { SingleMoreScene } from './scenes/single-more.scene';

@Module({
  imports: [
    ConfigModule,
    AccountModule,
    BlockchainModule,
    BlockchainEVMModule,
    BlockchainMainModule,
    BlockchainQueueModule,
    DexScreenerModule,
    BirdEyeModule,
    AnalyticsModule,
    TradeNotificationsAnalysisModule,
  ],
  controllers: [TelegramController],
  providers: [
    // Services
    TelegramUpdate,
    TelegramService,

    // // SCENES
    ReferScene,
    ChatScene,
    SettingsScene,
    PortfolioScene,
    WaitListScene,
    SellSLPScene,
    SingleSPLScene,
    WalletScene,
    BuySLPScene,
    SolTransferScene,
    XAmountSPLScene,
    TaxScene,
    SenseiScene,
    NinjaModeNewsScene,
    NinjaModeScene,
    KamikazeScene,
    BotBackupScene,
    ActivityScene,
    TopupScene,
    SingleMoreScene,

    // Scene Manager
    SceneManagerService,
    SceneLoaderService,
  ],
  exports: [TelegramService],
})
export class TelegramModule implements NestModule {
  logger = new Logger(TelegramModule.name);
  constructor(
    @InjectBot() private readonly bot: Bot<Context>,
    private sceneManager: SceneManagerService,
  ) {
    this.bot.use(this.sceneManager.getManager());
    this.bot.use(hydrateReply);
    this.bot.use(backToDojoKeyboardMenu, exitNinjaKeyboard);
    this.bot.use(conversations());
    this.bot.api.setMyCommands(BASE_COMMANDS);
    this.bot.use(createConversation(greeting, 'greeting'));
    this.bot.catch((err) => {
      console.error(err);
      this.logger.error(`Error for ${err.ctx}: ${err.message}`, 'GRAMMY');
    });

    // this.bot.use((ctx) => {
    //   // @ts-ignore
    //   ctx.webhookEnabled = true;
    //   return ctx;
    // });
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        webhookCallback(this.bot, 'express', {
          timeoutMilliseconds: 1000 * 60,
        }),
      )
      .forRoutes(process.env.WEBHOOK_PATH || '/telegram/webhook');
    this.logger.log('Webhook Api Configured ...');
  }
}

async function greeting(conversation, ctx) {
  await ctx.reply('Hi there! What is your name?');
  const { message } = await conversation.wait();
  await ctx.reply(`Welcome to the chat, ${message.text}!`);
}
