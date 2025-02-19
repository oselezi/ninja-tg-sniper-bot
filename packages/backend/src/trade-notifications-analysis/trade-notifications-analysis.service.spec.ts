import { Test, TestingModule } from '@nestjs/testing';
import { TradeNotificationsAnalysisService } from './trade-notifications-analysis.service';

describe('TradeNotificationsAnalysisService', () => {
  let service: TradeNotificationsAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradeNotificationsAnalysisService],
    }).compile();

    service = module.get<TradeNotificationsAnalysisService>(TradeNotificationsAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
