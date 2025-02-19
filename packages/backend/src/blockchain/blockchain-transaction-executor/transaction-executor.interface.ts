import {
  BlockhashWithExpiryBlockHeight,
  Keypair,
  VersionedTransaction,
} from '@solana/web3.js';

export interface TransactionExecutor {
  executeAndConfirm(
    transaction: VersionedTransaction,
    payer: Keypair,
    latestBlockHash: BlockhashWithExpiryBlockHeight,
  ): Promise<{ confirmed: boolean; signature?: string; error?: string }>;

  execute(
    transaction: VersionedTransaction,
    payer: Keypair,
    latestBlockHash: BlockhashWithExpiryBlockHeight,
  ): Promise<{ confirmed: boolean; signature?: string; error?: string }>;

  confirm(
    signature: string,
    latestBlockHash: BlockhashWithExpiryBlockHeight,
  ): Promise<{ confirmed: boolean; error?: string }>;
}
