import { Controller } from '@nestjs/common';
import { TradeNotificationsAnalysisService } from './trade-notifications-analysis.service';

@Controller('trade-notifications-analysis')
export class TradeNotificationsAnalysisController {
  constructor(private readonly tradeNotificationsAnalysisService: TradeNotificationsAnalysisService) {}
}
