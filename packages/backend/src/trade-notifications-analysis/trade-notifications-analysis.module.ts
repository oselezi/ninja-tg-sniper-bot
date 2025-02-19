import { Module } from '@nestjs/common';
import { TradeNotificationsAnalysisService } from './trade-notifications-analysis.service';
import { TradeNotificationsAnalysisController } from './trade-notifications-analysis.controller';

import { FirestoreModule } from '../firestore/firestore.module';
import { FirestoreService } from '../firestore/firestore.service';

@Module({
  imports: [FirestoreModule],
  controllers: [TradeNotificationsAnalysisController],
  providers: [TradeNotificationsAnalysisService, FirestoreService],
  exports: [TradeNotificationsAnalysisService],
})
export class TradeNotificationsAnalysisModule {}
