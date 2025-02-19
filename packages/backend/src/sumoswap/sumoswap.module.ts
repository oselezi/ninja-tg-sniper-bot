import { Module } from '@nestjs/common';
import { SumoswapService } from './sumoswap.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SumoswapService],
  exports: [SumoswapService],
})
export class SumoswapModule {}
