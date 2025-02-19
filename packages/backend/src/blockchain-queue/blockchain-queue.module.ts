import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BlockchainModule } from '@/blockchain/blockchain.module';

import { BlockchainQueueService } from './blockchain-queue.service';
import { BlockchainQueueProcessor } from './blockchain-queue.processor';
import { BullModule } from '@nestjs/bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BLOCKCHAIN_QUEUE_NAME } from './constants';
import { AccountModule } from '../account/account.module';
import { DexScreenerModule } from '../dexscreener/dexscreener.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { BlockchainMainModule } from '../blockchain-main/blockchain-main.module';

// import * as path from 'path';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync({
      name: BLOCKCHAIN_QUEUE_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      // useFactory: (configService: ConfigService) => ({
      //   prefix: configService.get<string>('QUEUE_PREFIX'),
      // }),
    }),
    BullBoardModule.forFeature({
      name: BLOCKCHAIN_QUEUE_NAME,
      adapter: BullAdapter,
    }),
    BlockchainMainModule,
    BlockchainModule,
    AccountModule,
    DexScreenerModule,
  ],
  providers: [BlockchainQueueService, BlockchainQueueProcessor],
  exports: [BlockchainQueueService, BullModule],
})
export class BlockchainQueueModule {}
