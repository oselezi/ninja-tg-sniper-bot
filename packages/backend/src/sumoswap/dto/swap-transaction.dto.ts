import { Transaction, VersionedTransaction } from '@solana/web3.js';

export class SwapTransactionDTO {
  tx: VersionedTransaction | Transaction;
  amountOut: number;
  amountIn: number;
}
