import {
  PublicKey,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  TransactionMessage,
} from '@solana/web3.js';
import { Logger, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import {
  AccountLayout,
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createJupiterApiClient } from '@jup-ag/api';
import { getTransactionExecutor } from './blockchain-transaction-executor';

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  fetchDigitalAsset,
  fetchDigitalAssetWithAssociatedToken,
  fetchAllDigitalAssetWithTokenByOwner,
} from '@metaplex-foundation/mpl-token-metadata';
import { Wallet } from '@project-serum/anchor';

import { DexScreenerService } from '../dexscreener/dexscreener.service';
import { SumoswapService } from '../sumoswap/sumoswap.service';
import { axios } from '../cache';
import { NINJA_TOKEN_ADDRESS } from '../telegram/constants';
import * as bs58 from 'bs58';
import { DEFAULT_SETTINGS } from '../account/types/settings.types';
import { Umi, publicKey } from '@metaplex-foundation/umi';

@Injectable()
export class BlockchainService {
  private connection: Connection;
  private tradeConnection: Connection;
  private umi: Umi;
  private jupiterQuoteApi: any;
  private REFERRAL_KEY = 'F9Hs3h2tseeRfYzQ74hQABFhYEMKBhGeTPfmSZGzWwLg';
  private readonly MAX_RETRIES = 3;
  private readonly logger = new Logger(BlockchainService.name);

  constructor(
    private configService: ConfigService,
    private readonly dexScreenerService: DexScreenerService,
    private readonly sumoswapService: SumoswapService,
  ) {
    const RPC_ENDPOINT =
      this.configService.get<string>('RPC_URL') ||
      clusterApiUrl('mainnet-beta');

    const FASTER_RPC_URL = this.configService.get<string>('FASTER_RPC_URL');
    this.connection = new Connection(RPC_ENDPOINT, {
      confirmTransactionInitialTimeout: 5000,
      commitment: 'processed',
      wsEndpoint: FASTER_RPC_URL.replaceAll('https', 'wss'),
    });
    this.tradeConnection = new Connection(RPC_ENDPOINT, {
      confirmTransactionInitialTimeout: 5000,
      commitment: 'confirmed',
      wsEndpoint: FASTER_RPC_URL.replaceAll('https', 'wss'),
    });
    this.umi = createUmi(RPC_ENDPOINT);

    this.umi.use(mplTokenMetadata());

    this.jupiterQuoteApi = createJupiterApiClient({});
  }

  solanaToLamports(sol: number) {
    return sol * LAMPORTS_PER_SOL;
  }

  sendTransaction = async (
    tx: Transaction | Uint8Array | VersionedTransaction,
    payer: Keypair,
    priorityFeeAmount: number = DEFAULT_SETTINGS.transaction_priority_amount,
  ) => {
    const executor = getTransactionExecutor(
      'jito',
      priorityFeeAmount,
      this.connection,
    );
    const latestBlockhash = await this.connection.getLatestBlockhash();
    console.log('tx', tx);
    // @ts-ignore
    return executor.execute(tx, payer, latestBlockhash);
  };

  async getBalance(walletPubKey: string) {
    const lamports = await this.connection.getBalance(
      new PublicKey(walletPubKey),
    );
    return {
      atomic: lamports,
      balance: lamports / LAMPORTS_PER_SOL,
      // TODO: MIGRATE BELOW - atomic / balance
      lamports: lamports,
      sol: lamports / LAMPORTS_PER_SOL,
    };
  }

  async getAllTokenAccounts(walletPubKey: string) {
    const data = await this.connection.getTokenAccountsByOwner(
      new PublicKey(walletPubKey),
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );

    // Decode all account data in one go
    const decodedAccounts = data.value.map((item) =>
      AccountLayout.decode(item.account.data),
    );

    // Fetch all mint info in parallel
    const mintInfos = await Promise.all(
      decodedAccounts.map((parsed) => getMint(this.connection, parsed.mint)),
    );

    // Combine decoded account data with mint info
    return decodedAccounts.map((parsed, index) => {
      const mintInfo = mintInfos[index];
      return {
        publicKey: parsed.mint.toString(),
        mint: {
          decimals: mintInfo.decimals,
        },
        token: {
          owner: parsed.owner.toString(),
          amount: parsed.amount,
          mintInfo: {
            decimals: mintInfo.decimals,
          },
        },
      };
    });
  }

  getTradeMethod(ctx): boolean {
    return (
      ctx.scene?.state?.isSniping ||
      ctx.session?.settings?.swap_provider == 'sumo' ||
      false
    );
  }

  getTokenAccountBalanceSafely = async (
    mintToken: string,
    walletPubKey: string,
  ): Promise<{
    token: any;
    metadata: any;
  }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await fetchDigitalAssetWithAssociatedToken(
          this.umi,
          // @ts-ignore
          new PublicKey(mintToken),
          new PublicKey(walletPubKey),
        );

        return resolve(token);
      } catch (e) {
        return resolve({
          token: {
            amount: 0,
          },
          metadata: {
            name: 'Unknown',
            symbol: '$Unknown',
          },
        });
      }
    });
  };

  async getTokenAccountBalance(mintToken: string, walletPubKey: string) {
    const data = await fetchDigitalAssetWithAssociatedToken(
      this.umi,
      publicKey(mintToken),
      publicKey(walletPubKey),
    );

    return {
      token: {
        amount: Number(data.token.amount),
        mint: data.token.mint,
      },
      mint: {
        decimals: data.mint.decimals,
      },
      metadata: {
        symbol: data.metadata.symbol,
      },
    };
  }

  getTokenMetadataByOwner = async (mintAddress) => {
    const metadata = await fetchAllDigitalAssetWithTokenByOwner(
      this.umi,
      mintAddress,
    );

    return metadata;
  };

  getMetadataByToken = async (token) => {
    try {
      const metadata = await fetchDigitalAsset(this.umi, token);
      return metadata;
    } catch (e) {
      return {
        publicKey: token,
        mint: {
          decimals: 0,
          supply: 0,
          freezeAuthority: '',
          mintAuthority: '',
        },
        metadata: {
          name: 'Unknown metadata',
          symbol: '$Unknown',
        },
      };
    }
  };

  validateSolanaWalletAddress = async (addr: string) => {
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(addr);
      return PublicKey.isOnCurve(publicKey);
    } catch (err) {
      this.logger.debug(err);
      return false;
    }
  };

  validateSLPAddress = async (addr: string) => {
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(addr);
      return publicKey;
    } catch (err) {
      this.logger.debug(err);
      return false;
    }
  };

  getTokenFromKnownURL = async (url: string) => {
    if (
      url.startsWith('https://birdeye.so/token/') ||
      url.startsWith('https://api.dexscreener.com/latest/dex/tokens/')
    ) {
      const regex = /(?:tokens|token)\/([^\/\?]+)/;
      const match = url.match(regex);
      return match ? match[1] : null;
    }

    if (
      url.startsWith('https://dexscreener.com/solana/') ||
      url.startsWith('https://api.dexscreener.com/latest/dex/pairs/solana/')
    ) {
      const regex = /\/([^\/]+)$/;
      const match = url.match(regex);
      const token = match ? match[1] : null;

      if (!token) return null;

      const [
        {
          baseToken: { address },
        },
      ] = await this.dexScreenerService.lookupToken(token, true);
      return address;
    }

    const regex = /\/token\/([A-Za-z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  getTokenFromString = async (str: string = '') => {
    const isUrl = str.includes('https://');

    if (isUrl) {
      const token = await this.getTokenFromKnownURL(str);
      if (!token) return null;
      const isValid = await this.validateSLPAddress(token);
      return isValid ? token : null;
    }

    // filter out any slashes for /CA commands
    const _str = str.replaceAll('/', '');

    const isValid = await this.validateSLPAddress(_str);
    return isValid ? _str : null;
  };

  // SWAP

  createReferralAccount = async (mint: string, feePayer: string) => {
    const { data } = await axios.post(
      `https://referral.jup.ag/api/referral/${this.REFERRAL_KEY}/token-accounts/create`,
      {
        mint,
        feePayer,
      },
    );

    this.logger.debug(data, 'REFERRAL_ACCOUNT_CREATE');

    return data;
  };

  getQuote = async (
    inputToken: string,
    outputToken: string,
    amount: number,
  ) => {
    return this.jupiterQuoteApi.quoteGet({
      inputMint: inputToken,
      outputMint: outputToken,
      amount: Math.floor(amount * LAMPORTS_PER_SOL),
      // swapMode: 'ExactIn',
      slippageBps: 2500, // - 25%
      platformFeeBps: 50, // - 0.5%
    });
  };

  getSwapTxn = async (wallet: Wallet, quote, outputMintReferral) => {
    let feeAccount: PublicKey;
    if (outputMintReferral) {
      try {
        const referralAccount = new PublicKey(
          'F9Hs3h2tseeRfYzQ74hQABFhYEMKBhGeTPfmSZGzWwLg',
          // 'F2sw2vGbrYeSpvSssVrwjPcdFzRC85FNnEPubeTmiCQ8',
        );

        const outputMintReferralKey = new PublicKey(outputMintReferral);

        // get the feeAccount.
        [feeAccount] = await PublicKey.findProgramAddressSync(
          [
            Buffer.from('referral_ata'),
            referralAccount.toBuffer(), // your referral account public key
            outputMintReferralKey.toBuffer(), // the token mint, output mint for ExactIn, input mint for ExactOut.
          ],
          new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3'), // the Referral Program
        );
        this.logger.log(feeAccount, 'FEE_ACCOUNT');
        this.logger.log(referralAccount, 'REFERRAL_ACCOUNT');
      } catch (e) {
        this.logger.error(e, 'REFERRAL_ERROR');
        this.logger.error(outputMintReferral, 'REFERRAL_ERROR_TOKEN');
        this.createReferralAccount(
          outputMintReferral,
          wallet.publicKey.toBase58(),
        );
      }
    }
    // get serialized transaction
    return this.jupiterQuoteApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        // computeUnitPriceMicroLamports: 1000000, // 0.01 Gas
        prioritizationFeeLamports: 10000000, // 0.01 SOL Tipping
        // feeAccount,
      },
    });
  };

  generateJupiterSwapTxn = async (
    wallet: Wallet,
    inputToken,
    outputToken,
    amount,
    priorityFeeAmount: number,
  ) => {
    try {
      const quote = await this.getQuote(inputToken, outputToken, amount);

      this.logger.log('Quote:', quote);
      const swapResult = await this.getSwapTxn(wallet, quote, outputToken);
      this.logger.log('swapResult:', swapResult);
      const swapTransactionBuf = Buffer.from(
        swapResult.swapTransaction,
        'base64',
      );
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // sign the transaction
      transaction.sign([wallet.payer]);

      const { signature } = await this.sendTransaction(
        transaction,
        wallet.payer,
        priorityFeeAmount,
      );

      // const rawTransaction = transaction.serialize();
      // const txId = await this.connection.sendRawTransaction(rawTransaction, {
      //   skipPreflight: false,
      //   preflightCommitment: 'singleGossip',
      //   maxRetries: 20,
      // });

      return {
        txId: signature,
        amountIn: Number(quote.inAmount) / LAMPORTS_PER_SOL,
        amountOut: Number(quote.outAmount) / LAMPORTS_PER_SOL,
      };
    } catch (e) {
      const res = (await e?.response?.json()) || {};
      throw new Error(res?.error || 'Unknown error');
    }
  };

  generateSumoSwapTxn = async (
    wallet: Wallet,
    inputToken,
    outputToken,
    amount,
    priorityFeeAmount,
  ) => {
    const { tx, amountIn, amountOut } = await this.sumoswapService.swap({
      wallet: wallet,
      amount: amount,
      inputToken: inputToken,
      outputToken: outputToken,
    });

    console.log('TX:', tx);

    //@ts-ignore
    tx.sign([wallet.payer]);
    //@ts-ignore
    const { signature } = await this.sendTransaction(
      tx,
      wallet.payer,
      priorityFeeAmount,
    );
    console.log('signature:', signature);
    return {
      txId: signature,
      amountIn,
      amountOut,
    };
  };

  createSwap = async (
    wallet: Wallet,
    inputToken,
    outputToken,
    amount,
    priorityFeeAmount: number,
    // method: 'jupiter' | 'sumo' = 'jupiter',
  ) => {
    let data;
    let result;
    try {
      try {
        // try sumo first
        data = await this.generateSumoSwapTxn(
          wallet,
          inputToken,
          outputToken,
          amount,
          priorityFeeAmount,
        );
      } catch (e) {
        console.log('Sumo failed:', e);
        // if sumo fails then try jupitens
        data = await this.generateJupiterSwapTxn(
          wallet,
          inputToken,
          outputToken,
          amount,
          priorityFeeAmount,
        );
      }

      this.logger.log(`https://solscan.io/tx/${data.txId}`);

      console.log('Data:', data);
      return {
        txId: data.txId,
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        url: `https://solscan.io/tx/${data.txId}`,
        txResult: result,
        status: 'TXID_NEW',
      };
    } catch (e) {
      console.warn(e, 'TXN_ERROR');
      let url = '';
      let error = 'TXID_ERROR';

      if (data?.txid) {
        url = `https://solscan.io/tx/${data.txid}`;
      }

      const message =
        e?.message ||
        'You may have insufficient funds or be trying to swap a token that has not yet been fully registered, please try again.';

      if (message.includes('is not tradable')) {
        error = 'TXID_ROUTING_ERROR';
      }
      return {
        txId: data?.txid,
        url: url,
        txResult: result,
        error: error,
        message: message,
      };
    }
  };

  confirmSwap = async (txid: string, attempt = 0) => {
    const TIMEOUT_REJECT = 3 * 60 * 1000;

    try {
      if (attempt >= this.MAX_RETRIES) {
        throw new Error(
          'Max retry attempts reached. Transaction confirmation failed.',
        );
      }

      const latestBlockHash = await this.tradeConnection.getLatestBlockhash();
      const controller = new AbortController();

      const result = await Promise.race([
        this.tradeConnection.confirmTransaction(
          {
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: txid,
            abortSignal: controller.signal,
          },
          'confirmed',
        ),
        new Promise((_, reject) =>
          setTimeout(() => {
            controller.abort();
            reject(new Error('Timeout exceeded. Transaction not confirmed.'));
          }, TIMEOUT_REJECT),
        ),
      ]);

      return {
        txId: txid,
        url: `https://solscan.io/tx/${txid}`,
        txResult: result,
        status: 'TXN_CONFIRMED',
      };
    } catch (e) {
      if (e.stack.includes('TransactionExpiredBlockheightExceededError')) {
        console.error(
          'Transaction expired, retrying...',
          `Attempt ${attempt + 1} of ${this.MAX_RETRIES}`,
        );

        // Collect the new blockhash and try to confirm the transaction again
        return await this.confirmSwap(txid, attempt + 1);
      }

      console.error(e, 'TXN_ERROR');

      return {
        txId: txid,
        url: `https://solscan.io/tx/${txid}`,
        error: 'TXID_ERROR',
        message: e?.message || 'Unknown error',
      };
    }
  };

  getTokenPrice = async (tokenId): Promise<string> => {
    const { data } = await axios.get(
      `https://price.jup.ag/v4/price?ids=${tokenId}`,
    );

    return data.data[tokenId]?.price || '-';
  };

  createTransfer = async (
    wallet: Wallet,
    amountSol: string,
    destination: string,
  ) => {
    // Convert recipient public key string to a PublicKey object

    const recipientPublicKey = new PublicKey(destination);

    // Convert SOL amount to lamports (the smallest unit of SOL)
    const amountLamports = LAMPORTS_PER_SOL * +amountSol;

    // Create a transaction instruction to send SOL
    // const transaction = new Transaction().add(
    //   SystemProgram.transfer({
    //     fromPubkey: wallet.publicKey,
    //     toPubkey: recipientPublicKey,
    //     lamports: amountLamports,
    //   }),
    // );

    const versionedTransaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: wallet.publicKey,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amountLamports,
          }),
        ],
        recentBlockhash: (await this.tradeConnection.getLatestBlockhash())
          .blockhash,
      }).compileToV0Message(),
    );

    versionedTransaction.sign([wallet.payer]);

    const txid =
      await this.tradeConnection.sendTransaction(versionedTransaction);

    // Sign and send the transaction
    // const txid = await sendAndConfirmTransaction(this.connection, transaction, [
    //   wallet.payer,
    // ]);
    // const txid = await this.connection.sendTransaction(transaction, [
    //   wallet.payer,
    // ]);
    console.log('Transaction successful with signature:', txid);

    return {
      txId: txid,
      url: `https://solscan.io/tx/${txid}`,
    };
  };

  getActivity = async (address: string, numTx: number, lastTx = '') => {
    //https://www.quicknode.com/guides/solana-development/transactions/how-to-get-transaction-logs-on-solana
    const publicKey = new PublicKey(address);
    const list = await this.tradeConnection.getSignaturesForAddress(publicKey, {
      before: lastTx || undefined,
      limit: numTx,
    });

    // const signatureList = list.map((transaction) => transaction.signature);

    // const transactionDetails = await this.connection.getParsedTransactions(
    //   signatureList,
    //   { maxSupportedTransactionVersion: 0 },
    // );

    return list.map((transaction, i) => {
      const date = new Date(transaction.blockTime * 1000);

      // const transactionInstructions =
      //   transactionDetails[i].transaction.message.instructions;

      // console.log(`Transaction No: ${i + 1}`);
      // console.log(`Signature: ${transaction.signature}`);
      // console.log(`Time: ${date}`);
      // console.log(`Status: ${transaction.confirmationStatus}`);
      // console.log(`Err: ${transaction.err}`);

      // transactionInstructions.forEach((instruction, n) => {
      //   console.log(
      //     `---Instructions ${n + 1}: ${instruction.programId.toString()}`,
      //   );
      // });
      // console.log('-'.repeat(20));

      return {
        date,
        signature: transaction.signature,
        status: transaction.confirmationStatus,
        err: transaction.err,
      };
    });
  };

  async burn({ walletPrivateKey, decimals, amount }: any) {
    try {
      console.log('Input', { walletPrivateKey, decimals, amount });

      const WALLET = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));

      console.log('WALLET', WALLET.publicKey.toString());

      const accountAssociated = await getAssociatedTokenAddress(
        new PublicKey(NINJA_TOKEN_ADDRESS),
        new PublicKey(WALLET.publicKey),
      );

      console.log('accountAssociated', accountAssociated);

      const burnIx = createBurnCheckedInstruction(
        accountAssociated, // PublicKey of Owner's Associated Token Account
        new PublicKey(NINJA_TOKEN_ADDRESS), // Public Key of the Token Mint Address
        new PublicKey(WALLET.publicKey), // Public Key of Owner's Wallet
        Math.floor(amount * 10 ** decimals), // Number of tokens to burn
        decimals, // Number of Decimals of the Token Mint
      );

      console.log('burnIx', burnIx);

      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash('finalized');

      console.log('blockhash', blockhash);
      console.log('lastValidBlockHeight', lastValidBlockHeight);

      const messageV0 = new TransactionMessage({
        payerKey: WALLET.publicKey,
        recentBlockhash: blockhash,
        instructions: [burnIx],
      }).compileToV0Message();

      console.log('messageV0', messageV0);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([WALLET]);

      console.log('transaction', transaction);
      const txid = await this.connection.sendTransaction(transaction);

      // const confirmation = await this.connection.confirmTransaction({
      //   signature: txid,
      //   blockhash: blockhash,
      //   lastValidBlockHeight: lastValidBlockHeight,
      // });

      // if (confirmation.value.err) {
      //   console.log(confirmation.value);
      //   return {
      //     error: true,
      //     message: confirmation.value.err || `Transaction not confirmed.`,
      //   };
      // }

      // console.log(
      //   '🔥 SUCCESSFUL BURN!🔥',
      //   '\n',
      //   `https://solscan.io/tx/${txid}`,
      // );
      return {
        txId: txid,
        message: `https://solscan.io/tx/${txid}`,
      };
    } catch (e) {
      console.log('Error:', e);
      return {
        error: true,
        message: e.message ?? `Burn failed. Unknown reason.`,
      };
    }
  }

  // DEPRECATED
  // async swap({ inputMint, outputMint, solAmount, wallet }: SwapDTO) {
  //   try {
  //     const data = await this.createSwap(
  //       wallet,
  //       inputMint,
  //       outputMint,
  //       solAmount,
  //     );

  //     console.log('Data:', data);

  //     if (data.error) {
  //       return `Mission failed 🚫, the network is busy. Check the amounts your sending.`;
  //     }

  //     return `Mission accomplished 🥷: \n ${data.url}`;
  //   } catch (e) {
  //     console.log('Error:', e);
  //     this.logger.error(e);
  //     return `Swap failed. Unknown reason.`;
  //   }
  // }
}
