import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainMainService } from './blockchain-main.service';

// EVM
import { BlockchainEVMModule } from '../blockchain-evm/blockchain-evm.module';
// SOLANA
import { BlockchainModule } from '../blockchain/blockchain.module';

import { DexScreenerModule } from '../dexscreener/dexscreener.module';

@Module({
  imports: [
    ConfigModule,
    DexScreenerModule,
    BlockchainEVMModule,
    BlockchainModule,
  ],
  providers: [BlockchainMainService],
  exports: [BlockchainMainService],
})
export class BlockchainMainModule {}
