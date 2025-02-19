import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { FirestoreService } from '@/firestore/firestore.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountService, FirestoreService],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
