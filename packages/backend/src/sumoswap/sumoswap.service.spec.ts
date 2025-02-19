import { Test, TestingModule } from '@nestjs/testing';
import { SumoswapService } from './sumoswap.service';

describe('SumoswapService', () => {
  let service: SumoswapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SumoswapService],
    }).compile();

    service = module.get<SumoswapService>(SumoswapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
