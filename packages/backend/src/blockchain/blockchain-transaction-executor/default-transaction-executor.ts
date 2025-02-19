import {
  BlockhashWithExpiryBlockHeight,
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { TransactionExecutor } from './transaction-executor.interface';
import { Logger } from '@nestjs/common';

export class DefaultTransactionExecutor implements TransactionExecutor {
  private readonly logger = new Logger(DefaultTransactionExecutor.name);

  constructor(private readonly connection: Connection) {}

  public async executeAndConfirm(
    transaction: VersionedTransaction,
    payer: Keypair,
    latestBlockhash: BlockhashWithExpiryBlockHeight,
  ): Promise<{ confirmed: boolean; signature?: string; error?: string }> {
    this.logger.debug('Executing transaction...');
    const { signature } = await this.execute(transaction);

    this.logger.debug({ signature }, 'Confirming transaction...');
    return this.confirm(signature, latestBlockhash);
  }

  public async execute(transaction: Transaction | VersionedTransaction) {
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      {
        preflightCommitment: this.connection.commitment,
      },
    );

    return { signature, error: undefined, confirmed: false };
  }

  public async confirm(
    signature: string,
    latestBlockhash: BlockhashWithExpiryBlockHeight,
  ) {
    const confirmation = await this.connection.confirmTransaction(
      {
        signature,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        blockhash: latestBlockhash.blockhash,
      },
      this.connection.commitment,
    );

    return { confirmed: !confirmation.value.err, signature };
  }
}
