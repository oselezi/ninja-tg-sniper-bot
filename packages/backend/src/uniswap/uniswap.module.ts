import { Module } from '@nestjs/common';
import { UniswapService } from './uniswap.service';

@Module({
  providers: [UniswapService],
  exports: [UniswapService],
})
export class UniswapModule {}
