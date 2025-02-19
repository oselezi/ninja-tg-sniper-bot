import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainEVMService } from './blockchain-evm.service';
import { DexScreenerModule } from '../dexscreener/dexscreener.module';
import { UniswapModule } from '../uniswap/uniswap.module';
import { BirdEyeModule } from '../birdeye/birdeye.module';

@Module({
  imports: [ConfigModule, DexScreenerModule, BirdEyeModule, UniswapModule],
  providers: [BlockchainEVMService],
  exports: [BlockchainEVMService],
})
export class BlockchainEVMModule {}
