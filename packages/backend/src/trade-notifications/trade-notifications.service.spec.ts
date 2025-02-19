import { Test, TestingModule } from '@nestjs/testing';
import { TradeNotificationsService } from './trade-notifications.service';

describe('TradeNotificationsService', () => {
  let service: TradeNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradeNotificationsService],
    }).compile();

    service = module.get<TradeNotificationsService>(TradeNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
