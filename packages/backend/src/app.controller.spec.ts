import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  const fixedDate = new Date('2024-03-12T15:00:00Z');
  beforeEach(async () => {
    // mocking date to expect correct date in controller's response:

    jest
      .spyOn(global, 'Date')
      .mockImplementation(() => fixedDate as unknown as Date);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('root', () => {
    it('should return ninja-bot response', () => {
      expect(appController.getHello()).toEqual({
        service: 'ninja-bot',
        status: 'ok',
        timestamp: fixedDate.toISOString(),
      });
    });
  });
});
