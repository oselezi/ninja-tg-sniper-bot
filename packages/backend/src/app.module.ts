import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebaseModule } from 'nestjs-firebase';
import { BullModule } from '@nestjs/bull';
import { NestjsGrammyModule } from '@grammyjs/nestjs';
import { session } from 'grammy';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './telegram/telegram.module';

import { LoggerModule } from './logger/logger.module';
import { FirestoreModule } from './firestore/firestore.module';
import { FirestoreService } from './firestore/firestore.service';
import { AccountModule } from './account/account.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { BlockchainEVMModule } from './blockchain-evm/blockchain-evm.module';
import { BlockchainMainModule } from './blockchain-main/blockchain-main.module';
import { TradeNotificationsModule } from './trade-notifications/trade-notifications.module';

import { BlockchainQueueModule } from './blockchain-queue/blockchain-queue.module';

import { adapter } from '@grammyjs/storage-firestore';
import { AnalyticsModule } from './analytics/analytics.module';
import { SumoswapModule } from './sumoswap/sumoswap.module';
import { TradeNotificationsAnalysisModule } from './trade-notifications-analysis/trade-notifications-analysis.module';
import { UniswapModule } from './uniswap/uniswap.module';

import rateLimit from './middleware/rate-limit.middleware';

import telegrafModuleConfig from './config/telegraf.config';
import { SESSION_DB } from '@/config/constants';

import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter, // Or FastifyAdapter from `@bull-board/fastify`
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        prefix: configService.get<string>('QUEUE_PREFIX'),
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
          enableTLSForSentinelMode: false,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
      inject: [ConfigService],
    }),

    LoggerModule,
    TelegramModule,
    NestjsGrammyModule.forRootAsync({
      imports: [
        ConfigModule.forFeature(telegrafModuleConfig),
        FirestoreModule,
        TelegramModule,
      ],
      useFactory: async (
        configService: ConfigService,
        firebase: FirestoreService,
      ) => {
        const db = await firebase.getFirestore().collection(SESSION_DB);
        return {
          useWebhook: configService.get<string>('WEBHOOK_ENABLED') === 'true',
          options: {
            client: {
              canUseWebhookReply: (method) => {
                return method === 'sendMessage';
              },
            },
          },
          token: configService.get<string>('TELEGRAM.BOT_TOKEN'),
          include: [TelegramModule],
          pollingOptions: {
            allowed_updates: ['chat_member', 'message', 'callback_query'],
            drop_pending_updates: process.env.NODE_ENV !== 'production',
          },
          middlewares: [
            session({
              initial: () => ({}),
              storage: adapter(db),
            }),
            // TODO: add rate limit
            rateLimit({
              storageClient: {
                host: configService.get<string>('REDIS_HOST'),
                port: configService.get<number>('REDIS_PORT'),
                password: configService.get<string>('REDIS_PASSWORD'),
                enableTLSForSentinelMode: false,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
              },
            }),
          ],
        };
      },
      inject: [ConfigService, FirestoreService],
    }),
    FirebaseModule.forRoot({
      googleApplicationCredential:
        // Production use ENV variable not service account.
        process.env.NODE_ENV === 'production'
          ? ''
          : path.join(
              __dirname,
              '../ninja-development-417014-firebase-adminsdk-gfrgx-ff20b5b006.json',
            ),
    }),
    FirestoreModule,
    AccountModule,

    //
    BlockchainEVMModule,
    BlockchainModule, // SOLANA

    BlockchainMainModule,

    TradeNotificationsModule,
    BlockchainQueueModule,
    AnalyticsModule,
    SumoswapModule,
    UniswapModule,
    TradeNotificationsAnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
