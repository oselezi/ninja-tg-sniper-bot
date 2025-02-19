import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import * as bs58 from 'bs58';

import { ConfigService } from '@nestjs/config';
import { SumoSwap } from './sumoswap.class';
import { SwapDTO } from './dto/swap.dto';
import { errorCodeMap } from './sumoswap.errrors';

@Injectable()
export class SumoswapService {
  private connection: Connection;
  private readonly logger = new Logger(SumoswapService.name);

  constructor(private readonly configService: ConfigService) {
    this.connection = new Connection(
      this.configService.get('SUMO_SWAP_RPC_URL'),
      {
        commitment: 'confirmed',
      },
    );
  }

  async swap({ wallet, amount, inputToken, outputToken }: SwapDTO) {
    try {
      const raydiumSwap = new SumoSwap(
        this.connection,
        wallet,
        this.configService.get('SUMO_SWAP_MAX_RETRY'),
      );

      this.logger.debug(`SumoSwap initialized`, wallet.publicKey.toBase58());
      this.logger.debug(
        `Swapping ${amount} of ${inputToken} for ${outputToken}...`,
      );

      /**
       * Find pool information for the given token pair.
       */
      const poolInfo = await raydiumSwap.findPoolInfoForTokens(
        inputToken,
        outputToken,
      );

      // READ
      // https://docs.raydium.io/raydium/pool-creation/creating-a-standard-amm-pool
      this.logger.debug(
        'Found pool info',
        poolInfo.id.toString(),
        poolInfo.baseMint.toString(),
        poolInfo.quoteMint.toString(),
      );

      const maxLamports = Number(
        this.configService.get('SUMO_SWAP_MAX_LAMPORTS') || '620280',
      );

      const swapDirection =
        this.configService.get('SUMO_SWAP_DIRECTION') || 'in';

      const amountAdjusted = amount;
      console.log('Amount adjusted:', amountAdjusted);
      /**
       * Prepare the swap transaction with the given parameters.
       */
      const { tx, amountIn, amountOut } = await raydiumSwap.getSwapTransaction(
        outputToken, // token out - USDC
        inputToken,
        amountAdjusted, // amount of token in of base - SOL
        poolInfo,
        maxLamports,
        true,
        swapDirection,
      );

      /**
       * Depending on the configuration, execute or simulate the swap.
       */

      // let txid = '';

      /**
       * Send the transaction to the network and log the transaction ID.
       */
      // txid = await raydiumSwap.sendVersionedTransaction(
      //   tx as VersionedTransaction,
      // );
      // this.logger.debug(`https://solscan.io/tx/${txid}`);

      return {
        tx,
        amountIn,
        amountOut,
      };
    } catch (e) {
      this.logger.debug(e);
      this.logger.debug(JSON.stringify(e, null, 2));
      this.parseRaydiumError(e);
      const error = this.extractErrorMessagesFromLogs(e?.logs);
      const errorMessage = error?.[0] || e.message;
      throw new Error(errorMessage);
    }
  }

  parseRaydiumError(error) {
    if (
      error.code == 'INVALID_ARGUMENT' &&
      error.argument == 'currencyAmounts'
    ) {
      throw new Error(
        `Low liquidity for the given token pair which will result in little or no tokens`,
      );
    }
  }

  extractErrorMessagesFromLogs(logs = []) {
    return logs
      .filter((log) => log.includes('failed: custom program error'))
      .map((log) => {
        const errorCodeHex = log.split(': ')[2].trim(); // Extracts something like "0x28"
        const errorCode = parseInt(errorCodeHex, 16); // Convert hex to decimal
        return errorCodeMap[errorCode]
          ? this.makeReadableFromCamelCase(errorCodeMap[errorCode])
          : `Unknown error code: ${errorCodeHex}`;
      });
  }
  makeReadableFromCamelCase(inputString) {
    // Use a regular expression to insert a space before each capital letter,
    // except for the very first character if it's uppercase.
    // The replace() method's callback is used here to ensure the replacement includes
    // the matched uppercase letter preceded by a space, except at the start.
    return inputString.replace(/([A-Z])/g, (match, p1, offset) =>
      offset === 0 ? p1 : ` ${p1}`,
    );
  }
}
