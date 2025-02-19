import { Controller, Get, Post, Req } from '@nestjs/common';

import { TradeNotificationsService } from './trade-notifications.service';

import { TokenEventType } from './types';

@Controller('trade-notifications')
export class TradeNotificationsController {
  constructor(
    private readonly tradeNotificationsService: TradeNotificationsService,
  ) {}

  @Get()
  getStatus() {
    return this.tradeNotificationsService.getStatus();
  }

  @Post()
  async createTradeNotification(@Req() req: any, @Req() res: any) {
    const { data }: { data: TokenEventType } = req.body;

    return await this.tradeNotificationsService.createTradeNotification(data);
  }
}
