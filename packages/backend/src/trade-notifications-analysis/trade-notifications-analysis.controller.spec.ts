import { Test, TestingModule } from '@nestjs/testing';
import { TradeNotificationsAnalysisController } from './trade-notifications-analysis.controller';
import { TradeNotificationsAnalysisService } from './trade-notifications-analysis.service';

describe('TradeNotificationsAnalysisController', () => {
  let controller: TradeNotificationsAnalysisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeNotificationsAnalysisController],
      providers: [TradeNotificationsAnalysisService],
    }).compile();

    controller = module.get<TradeNotificationsAnalysisController>(TradeNotificationsAnalysisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
