import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  Commitment,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import {
  Liquidity,
  LiquidityPoolKeys,
  Token,
  TokenAmount,
  TOKEN_PROGRAM_ID,
  Percent,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  LIQUIDITY_STATE_LAYOUT_V4,
  jsonInfo2PoolKeys,
} from '@raydium-io/raydium-sdk';
import { NATIVE_MINT, getMint } from '@solana/spl-token';
import BigNumber from 'bignumber.js';
import * as BN from 'bn.js';
import { Logger } from '@nestjs/common';

import { formatAmmKeysById } from './getMarket';

import { SwapTransactionDTO } from './dto/swap-transaction.dto';

const log = new Logger('sol:sumoswap');

/**
 * Class representing a Raydium Swap operation.
 */
export class SumoSwap {
  private connection: Connection;
  private wallet: Wallet;
  private maxRetries: number;
  private logger = new Logger(SumoSwap.name);
  /**
   * Create a RaydiumSwap instance.
   * @param {string} RPC_URL - The RPC URL for connecting to the Solana blockchain.
   * @param {string} WALLET_PRIVATE_KEY - The private key of the wallet in base58 format.
   */
  constructor(connection: Connection, wallet: Wallet, maxRetries?: number) {
    this.connection = connection;
    this.wallet = wallet;
    this.maxRetries = maxRetries || 20;

    // console.log("Wallet: ", this.wallet.publicKey.toString());
  }

  /**
   * Finds pool information for the given token pair.
   * @param {string} mintA - The mint address of the first token.
   * @param {string} mintB - The mint address of the second token.
   * @returns {LiquidityPoolKeys | null} The liquidity pool keys if found, otherwise null.
   */
  async findPoolInfoForTokens(
    mintA: string,
    mintB: string,
  ): Promise<LiquidityPoolKeys | null> {
    const baseMint = mintA == NATIVE_MINT.toString() ? mintA : mintB;
    const quoteMint = mintA != NATIVE_MINT.toString() ? mintA : mintB;

    // console.log("baseMint", baseMint);
    // console.log("quoteMint", quoteMint);
    const poolKeys = await this.fetchMarketAccounts(
      this.connection,
      new PublicKey(quoteMint),
      new PublicKey(baseMint), // SOL
      'processed',
    );

    if (!poolKeys) {
      throw new Error('Unable to find a trade route');
    }

    return poolKeys;
  }

  /**
   * Retrieves token accounts owned by the wallet.
   * @async
   * @returns {Promise<TokenAccount[]>} An array of token accounts.
   */
  async getOwnerTokenAccounts() {
    const walletTokenAccount = await this.connection.getTokenAccountsByOwner(
      this.wallet.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );

    return walletTokenAccount.value.map((i) => ({
      pubkey: i.pubkey,
      programId: i.account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
  }

  // Commission taken from the amountIn and amountOut in SOL
  calcTransactionAmountsInOut = (amount, directionIn = true) => {
    // MUST BE BigNumber as BN does not support decimals
    const totalSOL = new BigNumber(amount); // amountSOL should be in SOL, not lamports
    const commissionRate = new BigNumber(0.01); // || 0.01; // 1%
    const commissionAmount = totalSOL.times(commissionRate);

    const amountSOL = totalSOL.minus(commissionAmount);
    // amountSOLIn is the amount of SOL that will be sent to the swap instruction
    // SOL -> USDC
    // USDC -> SOL
    // amountSOLOut is the amount of SOL that will be sent to the swap instruction
    const amountInOut = directionIn ? amountSOL : totalSOL;
    console.log({
      directionIn: directionIn,
      totalSOL: totalSOL.toNumber(),
      commissionRate: commissionRate.toNumber(),
      commissionAmount: commissionAmount.toNumber(),
      amountInOut: amountInOut.toNumber(),
    });
    return {
      totalSOL,
      commissionRate,
      commissionAmount,
      amountInOut: amountInOut,
    };
  };

  /**
   * Builds a swap transaction.
   * @async
   * @param {string} toToken - The mint address of the token to receive.
   * @param {number} amount - The amount of the token to swap.
   * @param {LiquidityPoolKeys} poolKeys - The liquidity pool keys.
   * @param {number} [maxLamports=100000] - The maximum lamports to use for transaction fees.
   * @param {boolean} [useVersionedTransaction=true] - Whether to use a versioned transaction.
   * @param {'in' | 'out'} [fixedSide='in'] - The fixed side of the swap ('in' or 'out').
   * @returns {Promise<Transaction | VersionedTransaction>} The constructed swap transaction.
   */
  async getSwapTransaction(
    toToken: string,
    fromToken: string,
    amount: number,
    poolKeys: LiquidityPoolKeys,
    maxLamports: number = 100000,
    useVersionedTransaction = true,
    fixedSide: 'in' | 'out' = 'in',
  ): Promise<SwapTransactionDTO> {
    // base is the token that is being swapped
    // swapInDirection - The direction of the swap (true for in, false for out).
    const isTradingSOL = true; // SOL is the base token or Quote

    // const directionIn = poolKeys.quoteMint.toString() == toToken;
    // const directionIn =
    //   poolKeys.baseMint.toBase58() === NATIVE_MINT.toString()
    //     ? // BUY
    //       true
    //     : // SELL
    //       toToken === NATIVE_MINT.toString();

    const directionIn =
      poolKeys.baseMint.toBase58() === NATIVE_MINT.toString()
        ? fromToken === NATIVE_MINT.toString()
        : toToken === NATIVE_MINT.toString();

    this.logger.debug(
      'directionIn',
      directionIn,
      poolKeys.baseMint.toString(),
      poolKeys.quoteMint.toString(),
      toToken,
    );

    let toTokenDecimals = 9;
    let fromTokenDecimals = 9;

    if (toToken !== NATIVE_MINT.toString()) {
      const data = await getMint(this.connection, new PublicKey(toToken));

      toTokenDecimals = data.decimals;
    }

    if (fromToken !== NATIVE_MINT.toString()) {
      const data = await getMint(this.connection, new PublicKey(fromToken));

      fromTokenDecimals = data.decimals;
    }

    const swapFromSOL = toToken !== NATIVE_MINT.toString();
    const swapToSOL = toToken === NATIVE_MINT.toString();

    let amountCommissionAdjusted: BN = amount;
    let commissionAmountIn: BigNumber = new BigNumber(0);
    let commissionAmountOut: BigNumber = new BigNumber(0);

    // Swap out of SOL -> If the base token is SOL, we need to calculate the commission
    if (swapFromSOL) {
      const { commissionAmount: _commissionAmountIn, amountInOut } =
        this.calcTransactionAmountsInOut(amount, true);
      commissionAmountIn = _commissionAmountIn;
      amountCommissionAdjusted = amountInOut.toNumber();
    }

    const { minAmountOut, amountIn } = await this.calcAmountOut(
      poolKeys,
      amountCommissionAdjusted,
      directionIn,
    );

    // Swap to SOL ->  If the base token is SOL, we need to calculate the commission
    if (swapToSOL) {
      const amountOut = new BigNumber(
        minAmountOut.numerator.toString(),
      ).dividedBy(new BigNumber(minAmountOut.denominator.toString()));

      const { commissionAmount: _commissionAmountOut } =
        this.calcTransactionAmountsInOut(amountOut, false);

      commissionAmountOut = _commissionAmountOut
        .times(LAMPORTS_PER_SOL)
        .decimalPlaces(0, BigNumber.ROUND_HALF_UP);
    }

    this.logger.debug({ commissionAmountIn, commissionAmountOut });

    const userTokenAccounts = await this.getOwnerTokenAccounts();
    const swapTransaction = await Liquidity.makeSwapInstructionSimple({
      connection: this.connection,
      makeTxVersion: useVersionedTransaction ? 0 : 1,
      poolKeys: {
        ...poolKeys,
      },
      userKeys: {
        tokenAccounts: userTokenAccounts,
        owner: this.wallet.publicKey,
      },
      amountIn: amountIn,
      amountOut: minAmountOut,
      fixedSide: fixedSide,
      config: {
        bypassAssociatedCheck: false,
      },
      computeBudgetConfig: {
        microLamports: maxLamports,
      },
    });

    const txns = [];

    // -- COMMISSION

    if (commissionAmountIn.gt(0) || commissionAmountOut.gt(0)) {
      const commissionAmount: number = swapFromSOL
        ? BigNumber(commissionAmountIn).times(LAMPORTS_PER_SOL).toNumber()
        : commissionAmountOut.toNumber();

      this.logger.debug('commissionAmount', commissionAmount);
      const commissionTransferInstruction =
        this.getCommissionTransferInstruction(commissionAmount);
      txns.push(commissionTransferInstruction);
    }

    const recentBlockhashForSwap = await this.connection.getLatestBlockhash();
    const instructions =
      swapTransaction.innerTransactions[0].instructions.filter(Boolean);

    if (useVersionedTransaction) {
      const versionedTransaction = new VersionedTransaction(
        new TransactionMessage({
          payerKey: this.wallet.publicKey,
          recentBlockhash: recentBlockhashForSwap.blockhash,
          instructions: [...instructions, ...txns],
        }).compileToV0Message(),
      );

      // versionedTransaction.sign([this.wallet.payer]);

      return {
        amountOut: minAmountOut.raw.toNumber() / Math.pow(10, toTokenDecimals),
        // hide the commission amount from UI
        amountIn: swapFromSOL
          ? amount
          : amountIn.raw.toNumber() / Math.pow(10, fromTokenDecimals),
        tx: versionedTransaction,
      };
    }

    const legacyTransaction = new Transaction({
      blockhash: recentBlockhashForSwap.blockhash,
      lastValidBlockHeight: recentBlockhashForSwap.lastValidBlockHeight,
      feePayer: this.wallet.publicKey,
    });

    legacyTransaction.add(...instructions);

    return {
      amountOut: minAmountOut.raw.toNumber() / Math.pow(10, toTokenDecimals),
      // hide the commission amount from UI
      amountIn: swapFromSOL
        ? amount
        : amountIn.raw.toNumber() / Math.pow(10, fromTokenDecimals),
      tx: legacyTransaction,
    };
  }

  /**
   * Sends a legacy transaction.
   * @async
   * @param {Transaction} tx - The transaction to send.
   * @returns {Promise<string>} The transaction ID.
   */
  async sendLegacyTransaction(tx: Transaction) {
    const txid = await this.connection.sendTransaction(
      tx,
      [this.wallet.payer],
      {
        skipPreflight: true,
        maxRetries: this.maxRetries,
      },
    );

    return txid;
  }

  /**
   * Sends a versioned transaction.
   * @async
   * @param {VersionedTransaction} tx - The versioned transaction to send.
   * @returns {Promise<string>} The transaction ID.
   */
  async sendVersionedTransaction(tx: VersionedTransaction) {
    const txid = await this.connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: this.maxRetries,
    });

    return txid;
  }

  /**
   * Simulates a versioned transaction.
   * @async
   * @param {VersionedTransaction} tx - The versioned transaction to simulate.
   * @returns {Promise<any>} The simulation result.
   */
  async simulateLegacyTransaction(tx: Transaction) {
    const txid = await this.connection.simulateTransaction(tx, [
      this.wallet.payer,
    ]);

    return txid;
  }

  /**
   * Simulates a versioned transaction.
   * @async
   * @param {VersionedTransaction} tx - The versioned transaction to simulate.
   * @returns {Promise<any>} The simulation result.
   */
  async simulateVersionedTransaction(tx: VersionedTransaction) {
    const txid = await this.connection.simulateTransaction(tx);

    return txid;
  }

  /**
   * Gets a token account by owner and mint address.
   * @param {PublicKey} mint - The mint address of the token.
   * @returns {TokenAccount} The token account.
   */
  getTokenAccountByOwnerAndMint(mint: PublicKey) {
    return {
      programId: TOKEN_PROGRAM_ID,
      pubkey: PublicKey.default,
      accountInfo: {
        mint: mint,
        amount: 0,
      },
    } as unknown as TokenAccount;
  }

  getCommissionTransferInstruction(amount: number) {
    const commissionPublicKey = new PublicKey(
      process.env.SUMO_COMMISSION_WALLET || '',
    );

    // -- COMMISSION
    return SystemProgram.transfer({
      fromPubkey: this.wallet.publicKey,
      toPubkey: commissionPublicKey,
      lamports: amount,
    });
  }

  /**
   * Calculates the amount out for a swap.
   * @async
   * @param {LiquidityPoolKeys} poolKeys - The liquidity pool keys.
   * @param {number} rawAmountIn - The raw amount of the input token.
   * @param {boolean} swapInDirection - The direction of the swap (true for in, false for out).
   * @returns {Promise<Object>} The swap calculation result.
   */
  async calcAmountOut(
    poolKeys: LiquidityPoolKeys,
    rawAmountIn: number,
    swapInDirection: boolean,
  ) {
    this.logger.debug('Calculating amount out...');
    const poolInfo = await Liquidity.fetchInfo({
      connection: this.connection,
      poolKeys,
    });

    this.logger.debug('poolInfo', poolInfo);

    let currencyInMint = poolKeys.baseMint;
    let currencyInDecimals = poolInfo.baseDecimals;
    let currencyOutMint = poolKeys.quoteMint;
    let currencyOutDecimals = poolInfo.quoteDecimals;

    if (!swapInDirection) {
      currencyInMint = poolKeys.quoteMint;
      currencyInDecimals = poolInfo.quoteDecimals;
      currencyOutMint = poolKeys.baseMint;
      currencyOutDecimals = poolInfo.baseDecimals;
    }

    const currencyIn = new Token(
      TOKEN_PROGRAM_ID,
      currencyInMint,
      currencyInDecimals,
    );

    const amountIn = new TokenAmount(currencyIn, rawAmountIn, false);

    const currencyOut = new Token(
      TOKEN_PROGRAM_ID,
      currencyOutMint,
      currencyOutDecimals,
    );
    const slippage = new Percent(25, 100); // 5% slippage

    this.logger.debug('Calculating amount out...', slippage);
    const {
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn,
      currencyOut,
      slippage,
    });

    this.logger.debug({
      amountIn: amountIn.raw.toString(),
      amountOut: amountOut.raw.toString(),
      minAmountOut: minAmountOut.raw.toString(),
      currentPrice: currentPrice.toSignificant(6),
      executionPrice: executionPrice.toSignificant(6),
      priceImpact: priceImpact.toFixed(2),
      fee: fee.raw.toString(),
      slippage: slippage.toFixed(2),
    });

    return {
      amountIn,
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    };
  }

  evaluatePools(pools): string | null {
    const bestPool = pools.reduce((best, current) => {
      // Calculate total liquidity for current pool
      const currentLiquidity =
        current.quoteVaultBalance + current.baseVaultBalance;

      // Calculate total activity for current pool
      const currentActivity =
        current.swapQuoteInAmount +
        current.swapQuoteOutAmount +
        current.swapBaseInAmount +
        current.swapBaseOutAmount;

      // If no best pool has been identified yet, or the current pool has higher liquidity or activity, update best to current
      if (
        !best ||
        currentLiquidity > best.liquidity ||
        currentActivity > best.activity
      ) {
        return {
          id: current.id,
          liquidity: currentLiquidity,
          activity: currentActivity,
        };
      }

      return best;
    }, null);

    // Return the ID of the best pool or null if the pools array is empty
    return bestPool ? bestPool.id : null;
  }

  async fetchMarketAccounts(
    connection: Connection,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    commitment?: Commitment,
  ): Promise<LiquidityPoolKeys> {
        const accounts = (
      await Promise.all([
        connection.getProgramAccounts(
          new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
          {
            commitment,
            filters: [
              { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
              {
                memcmp: {
                  offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
                  bytes: baseMint.toBase58(),
                },
              },
              {
                memcmp: {
                  offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
                  bytes: quoteMint.toBase58(),
                },
              },
            ],
          },
        ),
        connection.getProgramAccounts(
          new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
          {
            commitment,
            filters: [
              { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
              {
                memcmp: {
                  offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
                  bytes: quoteMint.toBase58(),
                },
              },
              {
                memcmp: {
                  offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
                  bytes: baseMint.toBase58(),
                },
              },
            ],
          },
        ),
      ])
    ).flat();

    if (!accounts || !accounts[0]) {
      return null;
    }

    // TODO - find the correct pool when it is a common token and spam pools exists.

    const poolIds = await Promise.all(
      accounts.map(async ({ account, pubkey }) => {
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

        const quoteVaultBalance = await connection.getBalance(
          poolState.quoteVault,
        );

        const baseVaultBalance = await connection.getBalance(
          poolState.baseVault,
        );

        return {
          id: pubkey.toBase58(),
          quoteLoteSize: BigInt(new BN(poolState.quoteLotSize, 16).toString()),
          baseLoteSize: BigInt(new BN(poolState.baseLotSize, 16).toString()),
          quoteVaultBalance,
          baseVaultBalance,
          swapQuoteInAmount: BigInt(
            new BN(poolState.swapQuoteInAmount, 16).toString(),
          ),
          swapQuoteOutAmount: BigInt(
            new BN(poolState.swapQuoteOutAmount, 16).toString(),
          ),
          swapBaseInAmount: BigInt(
            new BN(poolState.swapBaseInAmount, 16).toString(),
          ),
          swapBaseOutAmount: BigInt(
            new BN(poolState.swapBaseOutAmount, 16).toString(),
          ),
        };
      }),
    );

    const evaluatedPool = this.evaluatePools(poolIds);

    if (!evaluatedPool) return;

    this.logger.debug('Found liquidity pool', poolIds);
    this.logger.debug('Evaluated liquidity pool', evaluatedPool);

    const targetPoolInfo = await formatAmmKeysById(connection, evaluatedPool);
    return jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;
  }
}
