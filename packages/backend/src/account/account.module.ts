import { Module } from '@nestjs/common';
import { FirestoreModule } from '../firestore/firestore.module';
import { FirestoreService } from '../firestore/firestore.service';
import { AccountService } from './account.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [FirestoreModule, AnalyticsModule, ConfigModule],
  providers: [FirestoreService, AccountService],
  exports: [FirestoreModule, AccountService],
})
export class AccountModule {}
