import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../firestore/firestore.service';
import { TokenEventType } from './types';
import { TelegramService } from '@/telegram/telegram.service';
import { Logger } from '@nestjs/common';
import { SESSION_DB } from '@/config/constants';

import { TradeNotificationsAnalysisService } from '../trade-notifications-analysis/trade-notifications-analysis.service';
import { BlockchainQueueService } from '../blockchain-queue/blockchain-queue.service';
import { DEFAULT_SETTINGS } from '../account/types/settings.types';
import { AccountService } from '../account/account.service';

@Injectable()
export class TradeNotificationsService {
  private logger = new Logger(TradeNotificationsService.name);
  constructor(
    private firestoreService: FirestoreService,
    private telegramService: TelegramService,
    private accountService: AccountService,
    private configService: ConfigService,
    private tradeNotificationsAnalysisService: TradeNotificationsAnalysisService,
    private blockchainQueueService: BlockchainQueueService,
  ) {}

  getStatus() {
    return {
      service: 'ninja-bot-trade-notifications',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // Cleanup function to deactivate ninjaMode
  private async cleanUpNinjaSessions(cleanSessions: string[]): Promise<void> {
    const batch = this.firestoreService.getFirestore().batch();

    cleanSessions.forEach((sessionId) => {
      const sessionRef = this.firestoreService
        .getFirestore()
        .collection(SESSION_DB)
        .doc(sessionId);
      batch.update(sessionRef, { 'ninjaMode.active': false });
    });

    await batch.commit();
  }

  async createTradeNotification(data: TokenEventType) {
    // const groupsToNotify = ['1379337057'];
    if (process.env.NOTIFICATIONS_DISABLED == 'true') {
      this.logger.log('Notifications disabled');
      return {
        message: 'Notifications disabled',
        groupsToNotify: [],
        promises: [],
        cleanSessions: [],
      };
    }

    const analysis =
      await this.tradeNotificationsAnalysisService.generateAnalysisForMeta(
        data.baseMint,
        JSON.stringify(data),
      );

    /*
      Analysis Response Example:
      {
        tokenAddress: "4sckKjDQC6edm42H5ie61zmBunZycd5oXWpB3GrKeT2y",
        title: "🐶 Dogs | Pixel Dog', Devil Dog, Gay Doge' | 4%",
        category: "dog",
        rating: 4,
        headline: "🚨 Match detected! 🚨",
        tags: [
        ],
        reasoning: "💬 Doug's canine vibes vibe with the Dog meta, sounds like fetch-worthy gains!",
        message: "🐶🚀 DOGS ARE ON THE RISE. STACK UP ON DOUG FOR GAINS! 💎🙌",
      }
    */
    if (!analysis.category) {
      this.logger.log(analysis, 'ANALYSIS_NO_MATCH');
      return {
        message: 'Notifications not sent for this category',
        groupsToNotify: [],
        promises: [],
        cleanSessions: [],
      };
    }

    const cleanSessions = [];

    const botId = await this.telegramService.getBotId();

    const tags = [analysis.category, ...analysis.tags];

    // find subscribers to notify of the new meta
    const ids =
      this.configService.get<string>('NOTIFICATION_BOT_IDS') ||
      botId.toString();

    const botIds: string[] = ids.split(',');

    console.log('NOTIFICATION_BOT_IDS', botIds);

    const queryGroupsToNotify = await Promise.all(
      botIds.map(async (botId) => {
        const snapshot = await this.firestoreService
          .getFirestore()
          .collection(SESSION_DB)
          .where('ninjaMode.tags', 'array-contains', analysis.category)
          .where('ninjaMode.botId', '==', Number(botId))
          .where('ninjaMode.active', '==', true)
          .get();

        return snapshot.docs;
      }),
    );

    const groupsToNotify = queryGroupsToNotify
      .flat() // merge all sub-arrays
      .filter(Boolean) // filter empty snapshots
      .map((doc) => {
        const data = doc.data();

        if (
          data.ninjaMode?.endAt &&
          data.ninjaMode?.endAt?.toDate() < new Date()
        ) {
          cleanSessions.push(doc.id);
        }

        return {
          chatId: data?.ninjaMode?.chatId || 0,
          botId: data?.ninjaMode?.botId || '',
          userId: doc.id,
          autoBuy: data?.ninjaMode?.autoBuy || false,
          autoBuyAmount: data?.ninjaMode?.autoBuyAmount || 0,
        };
      });

    const message = `Trade notification: ${JSON.stringify(data)}`;

    const notificationsJobs = groupsToNotify.map(({ chatId: group, botId }) => {
      // TODO: add to a message queue and stagger to avoid rate limiting the telegram API
      return this.telegramService.sendNotification(group, {
        mint: data.mint,
        name: data.name,
        symbol: data.symbol,
        rating: data.rating,
        image: data.image,
        description: data.description,
        message: data.message,
        baseMint: data.baseMint,

        aiTitle: analysis.title,
        aiCategory: analysis.category,
        aiRating: analysis.rating,
        aiHeadline: analysis.headline,
        aiTags: analysis.tags,
        aiMessage: analysis.message,
        aiReasoning: analysis.reasoning,
        botId: data.botId || botId,
      });
    });

    const autoBuyJobs = groupsToNotify.map(
      async ({ chatId: group, botId, userId, autoBuy, autoBuyAmount }) => {
        if (autoBuy) {
          const account = await this.accountService.get(userId);

          return this.blockchainQueueService.createSwap({
            groupId: group,
            botId: botId,
            userId: userId,
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: data.baseMint,
            symbol: data.symbol,
            solAmount: autoBuyAmount,
            priorityFeeAmount: Number(
              account?.settings?.transaction_priority_amount ||
                DEFAULT_SETTINGS.transaction_priority_amount,
            ),
            // swapProvider: 'sumo',
          });
        }
        return Promise.resolve();
      },
    );

    const promises = await Promise.all(notificationsJobs);

    const promisesAutoBuys = await Promise.all(autoBuyJobs);

    // Deactivate ninjaMode for sessions that have expired
    await this.cleanUpNinjaSessions(cleanSessions);

    return {
      message,
      groupsToNotify,
      promises,
      promisesAutoBuys,
      cleanSessions,
      analysis,
    };
  }
}
