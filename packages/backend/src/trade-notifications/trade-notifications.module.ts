import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TradeNotificationsService } from './trade-notifications.service';
import { TradeNotificationsController } from './trade-notifications.controller';

import { FirestoreModule } from '../firestore/firestore.module';
import { FirestoreService } from '../firestore/firestore.service';

import { TelegramService } from '../telegram/telegram.service';
import { TelegramModule } from '../telegram/telegram.module';

import { TradeNotificationsAnalysisModule } from '../trade-notifications-analysis/trade-notifications-analysis.module';
import { TradeNotificationsAnalysisService } from '../trade-notifications-analysis/trade-notifications-analysis.service';

import { BlockchainQueueModule } from '../blockchain-queue/blockchain-queue.module';
import { BlockchainQueueService } from '../blockchain-queue/blockchain-queue.service';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [
    FirestoreModule,
    TelegramModule,
    AccountModule,
    BlockchainQueueModule,
    TradeNotificationsAnalysisModule,
    ConfigModule,
  ],
  controllers: [TradeNotificationsController],
  providers: [
    FirestoreService,
    TradeNotificationsService,
    TelegramService,
    TradeNotificationsAnalysisService,
    BlockchainQueueService,
  ],
  exports: [FirestoreModule, TradeNotificationsService],
})
export class TradeNotificationsModule {}
