import { PublicKey } from '@solana/web3.js';
import { Logger, Injectable } from '@nestjs/common';

import Web3 from 'web3';
import { ethers, Wallet } from 'ethers';
import { axios } from '../cache';

import { ConfigService } from '@nestjs/config';
import { DexScreenerService } from '../dexscreener/dexscreener.service';
import { UniswapService } from '../uniswap/uniswap.service';
import { BirdEyeService } from '../birdeye/birdeye.service';

@Injectable()
export class BlockchainEVMService {
  private web3: Web3;
  private readonly logger = new Logger(BlockchainEVMService.name);

  constructor(
    private configService: ConfigService,
    private readonly dexScreenerService: DexScreenerService,
    private readonly uniswapService: UniswapService,
    private readonly birdeyeService: BirdEyeService,
  ) {
    const RPC_ENDPOINT = this.configService.get<string>('EVM_RPC_URL');

    this.web3 = new Web3(RPC_ENDPOINT);

    // --- SOLANA ---
    // const FASTER_RPC_URL = this.configService.get<string>('FASTER_RPC_URL');
    // this.connection = new Connection(RPC_ENDPOINT, {
    //   confirmTransactionInitialTimeout: 5000,
    //   commitment: 'confirmed',
    //   wsEndpoint: FASTER_RPC_URL.replaceAll('https', 'wss'),
    // });
    // this.tradeConnection = new Connection(RPC_ENDPOINT, {
    //   confirmTransactionInitialTimeout: 5000,
    //   commitment: 'confirmed',
    //   wsEndpoint: FASTER_RPC_URL.replaceAll('https', 'wss'),
    // });
    // this.umi = createUmi(RPC_ENDPOINT);

    // this.umi.use(mplTokenMetadata());

    // this.jupiterQuoteApi = createJupiterApiClient({});
  }

  async getDecimals(address: string) {
    const provider = new ethers.providers.JsonRpcProvider(
      this.configService.get('EVM_RPC_URL'),
    );

    const contract = new ethers.Contract(
      address,
      ['function decimals() view returns (uint8)'],
      provider,
    );

    const decimals = await contract.decimals();

    return Number(decimals);
  }

  // Converts Ether to Wei
  etherToWei(ether: string) {
    return this.web3.utils.toWei(ether, 'ether');
  }

  async getBalance(walletAddress: string) {
    const wei = await this.web3.eth.getBalance(walletAddress);
    const ether = this.web3.utils.fromWei(wei, 'ether');
    return {
      atomic: wei,
      balance: ether,
    };
  }

  // Create a transfer function for Ethereum
  createTransfer = async (
    wallet: Wallet,
    amountEther: string,
    destination: string,
  ) => {
    // Convert Ether amount to Wei (the smallest unit of Ether)
    const amountWei = this.etherToWei(amountEther);

    // Create a transaction object
    const transaction = {
      from: wallet.address,
      to: destination,
      value: amountWei,
    };

    // Sign and send the transaction

    const signedTx = await wallet.sendTransaction(transaction);
    this.logger.debug('Transaction successful with hash:', signedTx.hash);

    return {
      txId: signedTx.hash,
      url: `https://basescan.org/tx/${signedTx.hash}`,
    };
  };

  getAllTokenAccounts(walletPubKey: string) {
    return [];
    // return this.connection.getTokenAccountsByOwner(
    //   new PublicKey(walletPubKey),
    //   {
    //     programId: TOKEN_PROGRAM_ID,
    //   },
    // );
  }

  getTradeMethod(ctx): boolean {
    return (
      ctx.scene.state.isSniping ||
      ctx.session?.settings?.swap_provider == 'sumo' ||
      false
    );
  }

  async getTokenAccountBalance(mintToken: string, walletAddress: string) {
    const provider = new ethers.providers.JsonRpcProvider(
      this.configService.get('EVM_RPC_URL'),
    );

    try {
      const contract = new ethers.Contract(
        mintToken,
        [
          {
            constant: true,
            inputs: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
            ],
            name: 'balanceOf',
            outputs: [
              {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
              },
            ],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        provider,
      );
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await this.getDecimals(mintToken);
      const amountString = ethers.utils.formatUnits(balance, decimals);
      return {
        token: {
          amount: Number(amountString),
        },
        mint: {
          decimals,
        },
        metadata: {
          symbol: '',
        },
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }

  getTokenMetadataByOwner = async (walletAddress) => {
    console.log('walletAddress', walletAddress);
    // return [];
    const metadata =
      await this.birdeyeService.fetchEVMWalletTokens(walletAddress);

    return metadata.data.items;
  };

  getMetadataByToken = async (token: string) => {
    try {
      const [data] = await this.dexScreenerService.lookupToken(token);

      return {
        publicKey: data.baseToken.address,
        metadata: {
          symbol: data.baseToken.symbol,
          name: data.baseToken.name,
        },
        mint: {
          decimals: await this.getDecimals(token),
        },
      };
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
      url.startsWith('https://dexscreener.com/base/') ||
      url.startsWith('https://api.dexscreener.com/latest/dex/pairs/base/')
    ) {
      const regex = /\/([^\/]+)$/;
      const match = url.match(regex);
      const token = match ? match[1] : null;

      if (!token) return null;
      const address = token;
      // const {
      //   baseToken: { address },
      // } = await this.dexScreenerService.lookupToken(token, true);
      return address;
    }

    const regex = /\/token\/([A-Za-z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  getTokenFromString = async (str: string = '') => {
    console.log('str', str);
    const isUrl = str.includes('https://');

    if (isUrl) {
      const token = await this.getTokenFromKnownURL(str);
      if (!token) return null;

      return token;
      // const isValid = await this.validateSLPAddress(token);
      // return isValid ? token : null;
    }

    return str;

    // const isValid = await this.validateSLPAddress(str);
    // return isValid ? str : null;
  };

  createSwap = async (
    wallet: Wallet,
    inputToken: string,
    outputToken: string,
    amount: string,
  ) => {
    let data;
    try {
      data = await this.uniswapService.swap(
        wallet,
        inputToken,
        outputToken,
        amount,
      );

      return {
        error: '',
        message: '',
        url: `https://basescan.org/tx/${data.txId}`,
        txId: data.txId,
        amountIn: data.amountIn,
        amountOut: data.amountOut,
      };
    } catch (e) {
      console.warn(e, 'TXN_ERROR');
      let url = '';
      let error = 'TXID_ERROR';

      if (data?.txid) {
        url = `https://basescan.org/tx/${data.txid}`;
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
        txResult: '',
        error: error,
        message: message,
      };
    }
  };

  confirmSwap = async (txid: string) => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        this.configService.get('EVM_RPC_URL'),
      );

      let receipt: ethers.providers.TransactionReceipt | null = null;
      let message = '';

      while (receipt === null) {
        try {
          receipt = await provider.getTransactionReceipt(txid);

          if (receipt === null) {
            continue;
          }
        } catch (e) {
          console.log(`Receipt error:`, e);
          message = e?.message || 'Unknown error';
          break;
        }
      }

      if (message || receipt.status === 0) {
        return {
          txid,
          error: 'TXID_ERROR',
          message,
          url: `https://basescan.org/tx/${txid}`,
        };
      }

      return {
        txid,
        error: '',
        message: '',
        url: `https://basescan.org/tx/${txid}`,
        status: 'TXN_CONFIRMED',
      };
    } catch (e) {
      console.error(e, 'TXN_ERROR');

      return {
        txid,
        url: `https://basescan.org/tx/${txid}`,
        error: 'TXID_ERROR',
        message: e?.message || 'Unknown error',
      };
    }
  };
  // SWAP

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

  getTokenPrice = async (tokenId): Promise<string> => {
    const { data } = await axios.get(
      `https://price.jup.ag/v4/price?ids=${tokenId}`,
    );

    return data.data[tokenId]?.price || '-';
  };
}
