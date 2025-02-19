import { Test, TestingModule } from '@nestjs/testing';
import { TradeNotificationsController } from './trade-notifications.controller';
import { TradeNotificationsService } from './trade-notifications.service';

describe('TradeNotificationsController', () => {
  let controller: TradeNotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeNotificationsController],
      providers: [TradeNotificationsService],
    }).compile();

    controller = module.get<TradeNotificationsController>(TradeNotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
