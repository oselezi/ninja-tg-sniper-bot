import { Logger } from '@nestjs/common';
import { PORTFOLIO_SCENE, SOL_TRANSFER_SCENE } from '../constants';

import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { AccountService } from '../../account/account.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import {
  ANALYTICS_SCENE_VIEW,
  ANALYTICS_TRANSFER,
} from '@/analytics/analytics.types';

import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Bot } from 'grammy';
import { isEVMAddress } from '../../util';
import { InjectBot } from '@grammyjs/nestjs';
import { backToDojoKeyboardMenu } from '../common/keyboards';
import { BlockchainQueueService } from '../../blockchain-queue/blockchain-queue.service';

@Scene(SOL_TRANSFER_SCENE)
export class SolTransferScene {
  private logger = new Logger(SolTransferScene.name);

  constructor(
    private readonly blockchainMainService: BlockchainMainService,
    private readonly blockchainQueueService: BlockchainQueueService,
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
    @InjectBot() private readonly bot: Bot,
  ) {}

  @SceneEnter()
  async requestToken(ctx): Promise<any> {
    ctx.session.current_scene = SOL_TRANSFER_SCENE;

    const selectedWallet =
      ctx.scene?.arg?.selectedWallet || ctx.session?.transfer?.selectedWallet;

    ctx.session.transfer = {
      ...(ctx?.scene?.arg || ctx.session?.transfer),
    };

    if (!selectedWallet) {
      await ctx.reply('Please set your wallet address first');
      return ctx.scene.enter(PORTFOLIO_SCENE);
    }

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: SOL_TRANSFER_SCENE,
      chain: selectedWallet,
      userId: ctx.from.id,
    });

    const account = await this.accountService.get(`${ctx.from.id}`);

    const wallet = selectedWallet == 'evm' ? 'xWalletPubKey' : 'walletPubKey';
    const accountBalance = await this.blockchainMainService.getBalance(
      account[wallet],
    );

    ctx.session.balanceAvailable = accountBalance.balance;
    ctx.session[`balance_${selectedWallet}`] = accountBalance.balance;
    const balance = ctx.session[`balance_${selectedWallet}`];

    if (!balance || balance == 0) {
      await ctx.reply("You don't have any balance to transfer", {
        reply_markup: backToDojoKeyboardMenu,
      });
      return;
    }

    console.log('BALANCE:', ctx.session.balance);

    if (!ctx.session.balance) {
      await ctx.reply(
        `Reply with the amount to withdraw (0 - ${accountBalance.balance})`,
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );
    } else {
      await ctx.reply('Reply with the destination address', {
        reply_markup: {
          force_reply: true,
        },
      });
    }
  }

  async requestAmount(ctx) {
    const text =
      ctx?.update?.message?.text?.trim() || ctx.message?.text?.trim();

    console.log('REQUEST AMOUNT TEXT', text);

    if (!ctx.session.balance) {
      try {
        const selectedWallet = ctx.session.selectedWallet;
        const balanceAvailable = ctx.session[`balance_${selectedWallet}`];

        if (isNaN(parseFloat(text))) {
          await ctx.reply('Invalid amount');
          await this.requestToken(ctx);
          return;
        }

        if (parseFloat(text) > balanceAvailable) {
          await ctx.reply('Insufficient balance');
          await this.requestToken(ctx);
          return;
        }
        // Remove 0.5% for gas fees
        const balanceAvailableWithoutGas = balanceAvailable * 0.0995;
        if (parseFloat(text) > balanceAvailableWithoutGas) {
          await ctx.reply(
            'You must guarantee 0.5% of your balance for gas fee',
          );
          await this.requestToken(ctx);
          return;
        }

        ctx.session.balance = parseFloat(text);

        await ctx.reply('Reply with the destination address', {
          reply_markup: {
            force_reply: true,
          },
        });

        return;
      } catch (err) {
        console.log('Transfer failed', err);
        await ctx.reply('Transfer failed. Please try again later.');
        ctx.session.trackEvent = undefined;
        ctx.session.balance = null;
        ctx.session.current_scene = '';
        await ctx?.scene?.exit();
      }
    }

    const walletAddress =
      await this.blockchainMainService.getTokenFromString(text);

    console.log('WALLET ADDRESS:', walletAddress);

    if (!walletAddress) {
      await ctx.reply('Wallet not found');
      await this.requestToken(ctx);
      return;
    }

    const wallet = await this.accountService.getAccountWallet(`${ctx.from.id}`);

    console.log('WALLET:', wallet);

    await this.analyticsService.trackEvent(ANALYTICS_TRANSFER, {
      amount: ctx.session.balance,
      destination: walletAddress,
      userId: ctx.from.id,
    });

    const symbol = isEVMAddress(walletAddress) ? 'ETH' : 'SOL';
    const { message_id } = await this.bot.api.sendMessage(
      ctx.chat.id,
      `Starting transfer... ${ctx.session.balance} ${symbol}`,
    );

    try {
      const txData = await this.blockchainMainService.createTransfer(
        isEVMAddress(walletAddress) ? wallet.evm : wallet.solana,
        ctx.session.balance, // amount
        walletAddress,
      );

      await this.blockchainQueueService.transferConfirm({
        amount: ctx.session.balance,
        botId: ctx.me.username,
        groupId: `${ctx.chat.id}`,
        messageId: `${message_id}`,
        to: walletAddress,
        from: isEVMAddress(walletAddress)
          ? wallet.evm.address
          : wallet.solana.publicKey.toString(),
        txId: txData.txId,
        userId: `${ctx.from.id}`,
      });

      // await ctx.reply(`Transfer complete!\n${txData.url}`, {
      //   message_id,
      //   reply_markup: backToDojoKeyboardMenu,
      //   link_preview_options: {
      //     is_disabled: true,
      //   },
      // });
    } catch (err) {
      console.log('Transfer TO:', walletAddress);
      console.log('Transfer failed', err);
      await this.bot.api.editMessageText(
        ctx.chat.id,
        message_id,
        'Transfer failed. Please try again later.',
      );
    } finally {
      ctx.session.trackEvent = undefined;
      ctx.session.balance = null;
      ctx.session.current_scene = '';
      await ctx?.scene?.exit();
    }
  }
}
