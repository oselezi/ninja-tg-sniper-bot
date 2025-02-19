import { Logger } from '@nestjs/common';
import axios from 'axios';
import { BlockchainService } from '../blockchain/blockchain.service';

import { BLOCKCHAIN_QUEUE_NAME } from './constants';
import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueWaiting,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import * as https from 'https';
import { InjectBot } from '@grammyjs/nestjs';

import { SwapDTO, CreateSwapDTO } from './dto/swap.dto';
import { Bot, Context, InputFile } from 'grammy';
import { AccountService } from '../account/account.service';
import { formatCurrency, isEVMAddress } from '../util';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { DexScreenerService } from '../dexscreener/dexscreener.service';
import { BlockchainQueueService } from './blockchain-queue.service';
import { BlockchainMainService } from '../blockchain-main/blockchain-main.service';
import { ConfirmBurnDTO } from './dto/burn.dto';
import { ConfirmTransferDTO } from './dto/trasnfer.dto';

@Processor(BLOCKCHAIN_QUEUE_NAME)
export class BlockchainQueueProcessor {
  private readonly logger = new Logger(BlockchainQueueProcessor.name);

  constructor(
    private blockchainService: BlockchainService,
    private accountService: AccountService,
    private dexScreenerService: DexScreenerService,
    private blockchainQueueService: BlockchainQueueService,
    private blockchainMainService: BlockchainMainService,
    @InjectBot() private readonly bot: Bot<Context>,
  ) {}

  // createTransaction = async (data: any) => {
  //   this.logger.debug(`Creating transaction: ${JSON.stringify(data)}`);
  //   return await this.blockchainService.createTransaction(data);
  // };

  @Process('referral.create')
  async createReferralAccount(job: Job<any>) {
    try {
      this.logger.debug(`Creating referral account: ${JSON.stringify(job)}`);
      // @ts-ignore
      return await this.blockchainService.createReferralAccount(job.data);
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Process('swap.create')
  async createSwap(job: Job<CreateSwapDTO>) {
    const telegram = this.bot.api;
    const { inputMint, outputMint, solAmount, userId } = job.data;

    const wallet = await this.accountService.getAccountWallet(String(userId));
    // create the transaction
    const responseSwap = await this.blockchainService.createSwap(
      wallet.solana,
      inputMint,
      outputMint,
      solAmount,
      job.data.priorityFeeAmount,
      // swapProvider == 'sumo' ? 'sumo' : 'jupiter',
    );

    if (!responseSwap?.txId) {
      return 'Transaction failed';
    }

    const { message_id } = await telegram.sendMessage(
      job.data.groupId,
      `🔫 Snipe Amount: <b>${solAmount} SOL</b>\n\n⏳ <i>Processing transaction...</i>\n` +
        responseSwap?.url,
      {
        parse_mode: 'HTML',
        link_preview_options: {
          is_disabled: true,
        },
      },
    );

    // TODO - add swap confirmation job
    await this.blockchainQueueService.swapConfirm({
      groupId: job.data.groupId,
      botId: job.data.botId,
      userId: job.data.userId,
      side: 'buy',
      token: outputMint,
      symbol: job.data.symbol,
      amountIn: responseSwap?.amountIn,
      amountOut: responseSwap?.amountOut,
      txnId: responseSwap?.txId,
      messageId: `${message_id}`,
    });
  }

  @Process('swap.confirm')
  async confirmSwap(job: Job<SwapDTO>) {
    let confirmMessage = '';
    const telegram = this.bot.api;

    try {
      console.log(`Processing transaction: ${JSON.stringify(job)}`);
      // return await this.blockchainService.createSwap(data);

      this.logger.debug('Start transaction...');

      const responseConfirm = await this.blockchainMainService.confirmSwap(
        job.data.txnId,
      );

      if (responseConfirm.error) {
        if (responseConfirm.message.toLowerCase().includes('route')) {
          confirmMessage =
            `🚫 No Route Found\n` +
            `This token may not be available yet. Check token details and try again.`;

          await telegram.editMessageText(
            job.data.groupId,
            +job.data.messageId,
            confirmMessage,
            {
              link_preview_options: {
                is_disabled: true,
              },
            },
          );

          return;
        }

        if (responseConfirm.message.toLowerCase().includes('insufficient')) {
          const account = await this.accountService.get(
            job.data.userId.toString(),
          );

          const [balance, solanaBalance] = await Promise.all([
            this.blockchainService.getBalance(account.walletPubKey),
            this.blockchainService.getTokenPrice('SOL'),
          ]);

          confirmMessage =
            `🚫 Insufficient Funds\n` +
            `Transaction failed due to insufficient funds. Check your balance and try again.\n\n` +
            `---\n\n` +
            `<strong>💸 Balance: <b>${formatCurrency(balance.sol * +solanaBalance)} / ${balance.sol} SOL</strong>\n\n` +
            responseConfirm.url;

          await telegram.editMessageText(
            job.data.groupId,
            +job.data.messageId,
            confirmMessage,
            {
              link_preview_options: {
                is_disabled: true,
              },
            },
          );

          return;
        }

        confirmMessage =
          `🚫 Swap Failed\n` +
          `Unable to complete swap. Check bot settings and network congestion then try again.\n\n` +
          responseConfirm.url;

        await telegram.editMessageText(
          job.data.groupId,
          +job.data.messageId,
          confirmMessage,
          {
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
        return;
      }

      const account = await this.accountService.get(job.data.userId.toString());
      const wallet = await this.accountService.getAccountWallet(
        String(job.data.userId),
      );

      const isEVM = isEVMAddress(job.data.txnId);
      const symbol = isEVM ? 'ETH' : 'SOL';
      const [balance, solanaBalance, [tokenData], tokenBalance] =
        await Promise.all([
          this.blockchainMainService.getBalance(
            isEVM ? account.xWalletPubKey : account.walletPubKey,
          ),
          this.blockchainMainService.getTokenPrice(symbol),
          this.dexScreenerService.lookupToken(job.data.token),
          this.blockchainMainService.getTokenAccountBalance(
            job.data.token,
            isEVM ? account.xWalletPubKey : account.walletPubKey,
          ),
        ]);

      let walletBalance = new BigNumber(tokenBalance.token.amount.toString());

      if (!isEVM) {
        walletBalance = walletBalance.dividedBy(LAMPORTS_PER_SOL);
      }

      const valueBalanceNative = walletBalance.multipliedBy(
        tokenData.priceNative,
      );

      const valueBalanceUSD = walletBalance.multipliedBy(tokenData.priceUsd);

      const transactionLine = `<strong>${job.data.side === 'buy' ? `🛒 Buy / 🔁 ${job.data.amountOut.toFixed(4)} ${job.data.symbol} for ${job.data.amountIn} ${symbol}` : `💰 Sell / 🔁 ${job.data.amountIn.toFixed(2)} ${job.data.symbol} for ${job.data.amountOut.toFixed(4)} ${symbol}`}</strong>`;

      confirmMessage =
        `✅ Swap Successful\n\n` +
        transactionLine +
        `\n\n---\n\n` +
        `💰 Balance: <strong>${walletBalance.toFormat(4)} ${tokenBalance?.metadata?.symbol} / $${valueBalanceUSD.toFormat(2)} / ${valueBalanceNative.toFormat(2)} ${symbol}</strong>\n` +
        `💸 ${symbol} Balance: <strong>${formatCurrency(+balance.balance * +solanaBalance)} / ${balance.balance} ${symbol}</strong>\n` +
        ` \n${responseConfirm.url}`;

      await telegram.editMessageText(
        job.data.groupId,
        +job.data.messageId,
        confirmMessage,
        {
          // @ts-ignore
          chat_id: job.data.groupId,
          // @ts-ignore
          message_id: +job.data.messageId,

          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: true,
          },
        },
      );

      const token = job.data.token;
      const userWallet = wallet.solana.publicKey.toString();
      const userName = job.data.username;
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });
      const { data } = await axios.get<{
        image: any;
      }>(
        `${process.env.PNL_LINK}/generate-pl-card?wallet=${userWallet}&token=${token}&userName=${userName}`,
        { httpsAgent: agent },
      );
      console.log(
        { data: !!data?.image },
        `${process.env.PNL_LINK}/generate-pl-card?wallet=${userWallet}&token=${token}&userName=${userName}`,
        222,
      );
      const image = data?.image ?? null;
      if (image) {
        await telegram.sendPhoto(
          job.data.groupId,
          new InputFile(Buffer.from(image, 'base64')),
        );
      }

      // job.data.groupId;
      // job.data.messageId;
      console.log('Transaction completed');
      return;
    } catch (error) {
      this.logger.error(error?.stack, error);
      console.log('swap.confirm ERROR', error.message, job);
      if (error.message.indexOf('message to edit not found') >= 0) {
        console.log('message to edit not found');
        await telegram.sendMessage(job.data.groupId, confirmMessage, {
          // @ts-ignore
          chat_id: job.data.groupId,
          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: true,
          },
        });
      }
    }
  }

  @Process('burn.confirm')
  async confirmBurn(job: Job<ConfirmBurnDTO>) {
    let confirmMessage = '';
    const telegram = this.bot.api;

    try {
      const responseConfirm = await this.blockchainService.confirmSwap(
        job.data.txId,
      );

      if (responseConfirm.error) {
        await telegram.editMessageText(
          job.data.groupId,
          +job.data.messageId,
          `🚫 Burn Failed\n` +
            `Unable to complete burn. Check bot settings and network congestion then try again.\n\n` +
            responseConfirm.url,
          {
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
        return;
      }

      confirmMessage =
        `🔥 Burn Successful\n\n` +
        ` Amount: ${job.data.amount.toFixed(4)} NINJA\n` +
        ` ${responseConfirm.url}`;

      await telegram.editMessageText(
        job.data.groupId,
        +job.data.messageId,
        confirmMessage,
        {
          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: true,
          },
        },
      );

      // job.data.groupId;
      // job.data.messageId;
      this.logger.debug('Transaction completed');
      return;
    } catch (error) {
      this.logger.error(error?.stack, error);

      if (error.message.indexOf('message to edit not found') >= 0) {
        await telegram.sendMessage(job.data.groupId, confirmMessage, {
          link_preview_options: {
            is_disabled: true,
          },
        });
      }
    }
  }
  @Process('transfer.confirm')
  async confirmTransfer(job: Job<ConfirmTransferDTO>) {
    let confirmMessage = '';
    const telegram = this.bot.api;

    try {
      const responseConfirm = await this.blockchainMainService.confirmSwap(
        job.data.txId,
      );

      if (responseConfirm.error) {
        await telegram.editMessageText(
          job.data.groupId,
          +job.data.messageId,
          `🚫 Transfer Failed\n` +
            `Unable to complete transfer. Check bot settings and network congestion then try again.\n\n` +
            responseConfirm.url,
          {
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
        return;
      }

      const chainSymbol = isEVMAddress(job.data.to) ? 'ETH' : 'SOL';
      confirmMessage =
        `Transfer Successful\n\n` +
        ` Amount: ${job.data.amount.toString()} ${chainSymbol}\n` +
        ` ${responseConfirm.url}`;

      await telegram.editMessageText(
        job.data.groupId,
        +job.data.messageId,
        confirmMessage,
        {
          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: true,
          },
        },
      );

      this.logger.debug('Trasnfer completed');
      return;
    } catch (error) {
      this.logger.error(error?.stack, error);

      if (error.message.indexOf('message to edit not found') >= 0) {
        await telegram.sendMessage(job.data.groupId, confirmMessage, {
          link_preview_options: {
            is_disabled: true,
          },
        });
      }
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`Error processing job: ${error.message}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${error.message}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(
      `Job ${job.id} of type ${job.name} completed with result: ${job.returnvalue}`,
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number) {
    this.logger.debug(`Job ${jobId} is waiting...`);
  }
}
