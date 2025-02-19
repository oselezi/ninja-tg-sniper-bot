import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { DexScreenerModule } from '../dexscreener/dexscreener.module';
import { SumoswapModule } from '../sumoswap/sumoswap.module';
import { SumoswapService } from '../sumoswap/sumoswap.service';
@Module({
  imports: [ConfigModule, DexScreenerModule, SumoswapModule],
  providers: [BlockchainService, SumoswapService],
  exports: [BlockchainService, SumoswapService],
})
export class BlockchainModule {}
