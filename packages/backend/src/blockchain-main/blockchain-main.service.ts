import { Injectable } from '@nestjs/common';

// EVM
import { BlockchainEVMService } from '../blockchain-evm/blockchain-evm.service';
import { Wallet as WalletEth } from 'ethers';

// SOLANA
import { BlockchainService } from '../blockchain/blockchain.service';
import { Wallet as WalletSol } from '@project-serum/anchor';

@Injectable()
export class BlockchainMainService {
  constructor(
    private readonly blockchainEVMService: BlockchainEVMService,
    private readonly blockchainService: BlockchainService,
  ) {}

  isEVMWallet(walletAddress: string) {
    return walletAddress.startsWith('0x');
  }

  async getBalance(walletAddress: string) {
    if (this.isEVMWallet(walletAddress)) {
      const account = await this.blockchainEVMService.getBalance(walletAddress);

      return {
        name: 'BASE',
        symbol: 'ETH',
        address: walletAddress,
        balance: account.balance,
      };
    }

    const account = await this.blockchainService.getBalance(walletAddress);

    return {
      name: 'Solana',
      symbol: 'SOL',
      address: walletAddress,
      balance: account.balance,
    };
  }

  async getBalances(walletAddress: string[]) {
    const balances = await Promise.all(
      walletAddress
        .filter((address) => address)
        .map((address) => this.getBalance(address)),
    );

    return balances;
  }

  async getTokenMetadataByOwner(walletPubKey: string) {
    if (this.isEVMWallet(walletPubKey)) {
      return this.blockchainEVMService.getTokenMetadataByOwner(walletPubKey);
    }

    return this.blockchainService.getTokenMetadataByOwner(walletPubKey);
  }

  async getTokenPrice(token: string) {
    if (this.isEVMWallet(token)) {
      return this.blockchainEVMService.getTokenPrice(token);
    }

    return this.blockchainService.getTokenPrice(token);
  }

  getAllTokenAccounts(walletPubKey: string) {
    if (this.isEVMWallet(walletPubKey)) {
      return this.blockchainEVMService.getTokenMetadataByOwner(walletPubKey);
    }

    return this.blockchainService.getAllTokenAccounts(walletPubKey);
  }

  getTradeMethod(ctx): boolean {
    return (
      ctx?.scene?.arg?.isSniping ||
      ctx?.session?.settings?.swap_provider == 'sumo' ||
      false
    );
  }

  getTokenAccountBalance(mintToken: string, walletPubKey: string) {
    if (this.isEVMWallet(mintToken)) {
      return this.blockchainEVMService.getTokenAccountBalance(
        mintToken,
        walletPubKey,
      );
    }

    return this.blockchainService.getTokenAccountBalance(
      mintToken,
      walletPubKey,
    );
  }

  // getTokenMetadataByOwner = async (mintAddress) => {
  //   const metadata = await fetchAllDigitalAssetWithTokenByOwner(
  //     this.umi,
  //     mintAddress,
  //   );

  //   return metadata;
  // };

  getMetadataByToken = async (token: string) => {
    try {
      if (this.isEVMWallet(token)) {
        return this.blockchainEVMService.getMetadataByToken(token);
      }

      return this.blockchainService.getMetadataByToken(token);
    } catch (e) {
      return {
        publicKey: token,
        metadata: {
          name: 'Unknown metadata',
          symbol: '$Unknown',
        },
      };
    }
  };

  getTokenFromKnownURL = (url: string) => {
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
      return match ? match[1] : null;
    }

    if (
      url.startsWith('https://dexscreener.com/base/') ||
      url.startsWith('https://api.dexscreener.com/latest/dex/pairs/base/')
    ) {
      const regex = /\/([^\/]+)$/;
      const match = url.match(regex);
      return match ? match[1] : null;
    }

    const regex = /\/token\/([A-Za-z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  getTokenFromString = async (str: string = '') => {
    const token = str.startsWith('https://')
      ? this.getTokenFromKnownURL(str)
      : str;

    if (this.isEVMWallet(token)) {
      return this.blockchainEVMService.getTokenFromString(token);
    }

    return this.blockchainService.getTokenFromString(token);
  };

  createSwap = async (
    wallet: WalletSol | WalletEth,
    inputToken,
    outputToken,
    amount,
    priorityFeeAmount,
    // method: 'jupiter' | 'sumo' = 'jupiter',
  ) => {
    const isEVM = this.isEVMWallet(inputToken) || this.isEVMWallet(outputToken);

    if (isEVM) {
      return this.blockchainEVMService.createSwap(
        wallet as WalletEth,
        inputToken,
        outputToken,
        amount,
      );
    }

    return this.blockchainService.createSwap(
      wallet as WalletSol,
      inputToken,
      outputToken,
      amount,
      priorityFeeAmount,
    );
  };

  confirmSwap = async (txid: string) => {
    if (this.isEVMWallet(txid)) {
      return this.blockchainEVMService.confirmSwap(txid);
    }

    return this.blockchainService.confirmSwap(txid);
  };

  createTransfer = async (
    wallet: WalletSol | WalletEth,
    amount: string,
    destination: string,
  ) => {
    if (wallet instanceof WalletEth) {
      console.log('ETH TRANSFER');
      const data = await this.blockchainEVMService.createTransfer(
        wallet,
        amount,
        destination,
      );

      return data;
    } else if (wallet instanceof WalletSol) {
      console.log('SOL TRANSFER');
      const data = await this.blockchainService.createTransfer(
        wallet,
        amount,
        destination,
      );

      return data;
    } else {
      throw new Error('Invalid wallet type');
    }
  };
  // // SWAP

  // createReferralAccount = async (mint: string, feePayer: string) => {
  //   const { data } = await axios.post(
  //     `https://referral.jup.ag/api/referral/${this.REFERRAL_KEY}/token-accounts/create`,
  //     {
  //       mint,
  //       feePayer,
  //     },
  //   );

  //   this.logger.debug(data, 'REFERRAL_ACCOUNT_CREATE');

  //   return data;
  // };

  // getQuote = async (
  //   inputToken: string,
  //   outputToken: string,
  //   amount: number,
  // ) => {
  //   return this.jupiterQuoteApi.quoteGet({
  //     inputMint: inputToken,
  //     outputMint: outputToken,
  //     amount: amount,
  //     // swapMode: 'ExactIn',
  //     slippageBps: 2500, // - 25%
  //     platformFeeBps: 50, // - 0.5%
  //   });
  // };

  // getSwapTxn = async (wallet: Wallet, quote, outputMintReferral) => {
  //   let feeAccount: PublicKey;
  //   if (outputMintReferral) {
  //     try {
  //       const referralAccount = new PublicKey(
  //         'F9Hs3h2tseeRfYzQ74hQABFhYEMKBhGeTPfmSZGzWwLg',
  //         // 'F2sw2vGbrYeSpvSssVrwjPcdFzRC85FNnEPubeTmiCQ8',
  //       );

  //       const outputMintReferralKey = new PublicKey(outputMintReferral);

  //       // get the feeAccount.
  //       [feeAccount] = await PublicKey.findProgramAddressSync(
  //         [
  //           Buffer.from('referral_ata'),
  //           referralAccount.toBuffer(), // your referral account public key
  //           outputMintReferralKey.toBuffer(), // the token mint, output mint for ExactIn, input mint for ExactOut.
  //         ],
  //         new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3'), // the Referral Program
  //       );
  //       this.logger.log(feeAccount, 'FEE_ACCOUNT');
  //       this.logger.log(referralAccount, 'REFERRAL_ACCOUNT');
  //     } catch (e) {
  //       this.logger.error(e, 'REFERRAL_ERROR');
  //       this.logger.error(outputMintReferral, 'REFERRAL_ERROR_TOKEN');
  //       this.createReferralAccount(
  //         outputMintReferral,
  //         wallet.publicKey.toBase58(),
  //       );
  //     }
  //   }
  //   // get serialized transaction
  //   return this.jupiterQuoteApi.swapPost({
  //     swapRequest: {
  //       quoteResponse: quote,
  //       userPublicKey: wallet.publicKey.toBase58(),
  //       wrapAndUnwrapSol: true,
  //       // computeUnitPriceMicroLamports: 7000000, // 0.007 Gas
  //       prioritizationFeeLamports: 7000000, // 0.007 SOL Tipping
  //       // feeAccount,
  //     },
  //   });
  // };

  // generateJupiterSwapTxn = async (
  //   wallet: Wallet,
  //   inputToken,
  //   outputToken,
  //   amount,
  // ) => {
  //   try {
  //     const quote = await this.getQuote(inputToken, outputToken, amount);

  //     this.logger.log('Quote:', quote);
  //     const swapResult = await this.getSwapTxn(wallet, quote, outputToken);
  //     this.logger.log('swapResult:', swapResult);
  //     const swapTransactionBuf = Buffer.from(
  //       swapResult.swapTransaction,
  //       'base64',
  //     );
  //     const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  //     // sign the transaction
  //     transaction.sign([wallet.payer]);

  //     const rawTransaction = transaction.serialize();

  //     return await this.connection.sendRawTransaction(rawTransaction, {
  //       skipPreflight: false,
  //       preflightCommitment: 'singleGossip',
  //       maxRetries: 10,
  //     });
  //   } catch (e) {
  //     const res = (await e?.response?.json()) || {};
  //     throw new Error(res?.error || 'Unknown error');
  //   }
  // };

  // generateSumoSwapTxn = async (
  //   wallet: Wallet,
  //   inputToken,
  //   outputToken,
  //   amount,
  // ) => {
  //   const txnId = await this.sumoswapService.swap({
  //     wallet: wallet,
  //     amount: amount,
  //     inputToken: inputToken,
  //     outputToken: outputToken,
  //   });

  //   return txnId;
  // };

  // createSwap = async (
  //   wallet: Wallet,
  //   inputToken,
  //   outputToken,
  //   amount,
  //   method: 'jupiter' | 'sumo' = 'jupiter',
  // ) => {
  //   let txid;
  //   let result;
  //   try {
  //     if (method == 'jupiter') {
  //       txid = await this.generateJupiterSwapTxn(
  //         wallet,
  //         inputToken,
  //         outputToken,
  //         amount,
  //       );
  //     }
  //     if (method == 'sumo') {
  //       txid = await this.generateSumoSwapTxn(
  //         wallet,
  //         inputToken,
  //         outputToken,
  //         amount,
  //       );
  //     }

  //     this.logger.log(`https://solscan.io/tx/${txid}`);

  //     return {
  //       txId: txid,
  //       url: `https://solscan.io/tx/${txid}`,
  //       txResult: result,
  //       status: 'TXID_NEW',
  //     };
  //   } catch (e) {
  //     console.warn(e, 'TXN_ERROR');

  //     let error = 'TXID_ERROR';
  //     const message =
  //       e?.message ||
  //       'You may have insufficient funds or be trying to swap a token that has not yet been fully registered, please try again.';

  //     if (message.includes('is not tradable')) {
  //       error = 'TXID_ROUTING_ERROR';
  //     }
  //     return {
  //       txId: txid,
  //       url: `https://solscan.io/tx/${txid}`,
  //       txResult: result,
  //       error: error,
  //       message: message,
  //     };
  //   }
  // };

  // confirmSwap = async (txid: string) => {
  //   const TIMEOUT_REJECT = 1 * 60 * 1000;

  //   try {
  //     const latestBlockHash = await this.tradeConnection.getLatestBlockhash();
  //     const controller = new AbortController();

  //     const result = await Promise.race([
  //       this.tradeConnection.confirmTransaction(
  //         {
  //           blockhash: latestBlockHash.blockhash,
  //           lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  //           signature: txid,
  //           abortSignal: controller.signal,
  //         },
  //         'confirmed',
  //       ),
  //       new Promise((_, reject) =>
  //         setTimeout(() => {
  //           controller.abort();
  //           reject(new Error('Timeout exceeded. Transaction not confirmed.'));
  //         }, TIMEOUT_REJECT),
  //       ),
  //     ]);

  //     return {
  //       txId: txid,
  //       url: `https://solscan.io/tx/${txid}`,
  //       txResult: result,
  //       status: 'TXN_CONFIRMED',
  //     };
  //   } catch (e) {
  //     console.error(e, 'TXN_ERROR');

  //     return {
  //       txId: txid,
  //       url: `https://solscan.io/tx/${txid}`,
  //       error: 'TXID_ERROR',
  //       message: e?.message || 'Unknown error',
  //     };
  //   }
  // };

  // getTokenPrice = async (tokenId): Promise<string> => {
  //   const { data } = await axios.get(
  //     `https://price.jup.ag/v4/price?ids=${tokenId}`,
  //   );

  //   return data.data[tokenId]?.price || '-';
  // };

  // createTransfer = async (
  //   wallet: Wallet,
  //   amountSol: string,
  //   destination: string,
  // ) => {
  //   // Convert recipient public key string to a PublicKey object

  //   const recipientPublicKey = new PublicKey(destination);

  //   // Convert SOL amount to lamports (the smallest unit of SOL)
  //   const amountLamports = LAMPORTS_PER_SOL * +amountSol;

  //   // Create a transaction instruction to send SOL
  //   const transaction = new Transaction().add(
  //     SystemProgram.transfer({
  //       fromPubkey: wallet.publicKey,
  //       toPubkey: recipientPublicKey,
  //       lamports: amountLamports,
  //     }),
  //   );

  //   // Sign and send the transaction
  //   const txid = await sendAndConfirmTransaction(this.connection, transaction, [
  //     wallet.payer,
  //   ]);
  //   console.log('Transaction successful with signature:', txid);

  //   return {
  //     txId: txid,
  //     url: `https://solscan.io/tx/${txid}`,
  //   };
  // };

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
