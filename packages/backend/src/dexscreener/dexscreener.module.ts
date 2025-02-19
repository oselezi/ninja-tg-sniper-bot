import { Module } from '@nestjs/common';
import { DexScreenerService } from './dexscreener.service';

@Module({
  providers: [DexScreenerService],
  exports: [DexScreenerService],
})
export class DexScreenerModule {}
