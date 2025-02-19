import { SINGLE_SLP_SCENE, X_AMOUNT_SPL_SCENE } from '../constants';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AccountService } from '../../account/account.service';
import { BlockchainQueueService } from '../../blockchain-queue/blockchain-queue.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import BigNumber from 'bignumber.js';
import {
  ANALYTICS_SCENE_VIEW,
  ANALYTICS_TRADE,
} from '../../analytics/analytics.types';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Scene as GrammyScene } from 'grammy-scenes';
import { formatCurrency, resolve, isEVMAddress } from '../../util';
import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { DEFAULT_SETTINGS } from '../../account/types/settings.types';

@Scene(X_AMOUNT_SPL_SCENE)
export class XAmountSPLScene {
  scene: GrammyScene;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly accountService: AccountService,
    private readonly blockchainQueueService: BlockchainQueueService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @SceneEnter()
  async requestAmount(ctx): Promise<any> {
    // TODO: Detect is the amount is set?
    // move to next scene
    const { isBuy, amount, inputMint, outputMint } = ctx.scene.arg;
    const { name } = ctx.session.data;

    ctx.session.x = {
      ...ctx.scene.arg,
    };

    if (amount > 0) {
      await this.handleSwap(ctx, amount);
      return;
    }

    ctx.session.current_scene = X_AMOUNT_SPL_SCENE;

    const isEVM = isEVMAddress(inputMint) || isEVMAddress(outputMint);
    const symbol = isEVM ? 'ETH' : 'SOL';

    const message = isBuy
      ? `How much ${symbol} do you want to buy?`
      : `How much percentage of ${name} do you want to sell? (0 - 100%)`;

    await ctx.reply(message, {
      reply_markup: {
        force_reply: true,
        // keyboard: closeKeyboard,
      },
    });

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: SINGLE_SLP_SCENE,
      userId: ctx.from.id,
    });
  }

  async getCalculatedPercentage(
    walletPubKey: string,
    token: string,
    decimals: number,
    percentage: number,
  ) {
    let _amountOwned = new BigNumber(0);

    const [error, asset] = await resolve(
      this.blockchainMainService.getTokenAccountBalance(token, walletPubKey),
    );
    if (error) {
      return 0;
    }

    _amountOwned = new BigNumber(asset.token.amount.toString());

    if (!isEVMAddress(token)) {
      _amountOwned = new BigNumber(asset.token.amount.toString()).dividedBy(
        decimals <= 0 || decimals > 9 ? LAMPORTS_PER_SOL : 10 ** decimals,
      );
    }

    const _percentage = new BigNumber(
      percentage >= 100 ? 99.95 : percentage,
    ).dividedBy(100);
    const output = _amountOwned.multipliedBy(_percentage);
    // .integerValue(BigNumber.ROUND_DOWN);

    console.log('amountOwned:', _amountOwned.toString());
    console.log('output:', output.toString());

    return isEVMAddress(token)
      ? parseFloat(output.toFixed(6))
      : output.toNumber();
  }

  async handleSwap(ctx, amount: number) {
    const { inputMint, outputMint, userId, isBuy, token } = ctx.session.x;

    const isEVM = isEVMAddress(inputMint) || isEVMAddress(outputMint);

    const isSniping =
      !isEVMAddress(inputMint) &&
      this.blockchainMainService.getTradeMethod(ctx);

    const [
      {
        metadata: { symbol },
        // @ts-ignore
        mint: { decimals },
      },
      wallet,
    ] = await Promise.all([
      this.blockchainMainService.getMetadataByToken(token),
      this.accountService.getAccountWallet(String(userId)),
    ]);

    // LEAVE AS REPLY to webhook
    if (process.env.WEBHOOK_ENABLED === 'true') {
      await ctx.reply('');
    }

    // NOW USE API
    const { message_id } = await ctx.reply(`Initiating ninja mode`);
    let solAmount = 0;

    solAmount = isBuy
      ? Number(amount)
      : await this.getCalculatedPercentage(
          isEVM
            ? wallet.evm.address.toString()
            : wallet.solana.publicKey.toString(),
          token,
          decimals || 0,
          Number(amount),
        );

    // If sniping, convert to SOL Jupiter and Sumo expect different units
    if (isSniping) solAmount = isBuy ? Number(amount) : solAmount;
    // WARNING - This is a hack to convert to SOL removed as ended up with 0 on sell
    // : Math.round(solAmount / LAMPORTS_PER_SOL);

    console.log('isSniping', isSniping);
    console.log('solAmount:', solAmount);

    const responseSwap = await this.blockchainMainService.createSwap(
      isEVM ? wallet.evm : wallet.solana,
      inputMint,
      outputMint,
      solAmount,
      Number(
        ctx?.session?.settings?.transaction_priority_amount ||
          DEFAULT_SETTINGS.transaction_priority_amount,
      ),
      // isSniping ? 'sumo' : 'jupiter',
    );

    if (responseSwap.error) {
      if (responseSwap.message.toLowerCase().includes('route')) {
        await ctx.editMessageText(
          `🚫 No Route Found\n` +
            `This token may not be available yet. Check token details and try again.`,
          {
            message_id,
          },
        );
        await ctx.scene?.exit();
        return;
      }

      if (responseSwap.message.toLowerCase().includes('insufficient')) {
        const [balance, solanaBalance] = await Promise.all([
          this.blockchainMainService.getBalance(
            isEVM
              ? wallet.evm.address.toString()
              : wallet.solana.publicKey.toString(),
          ),
          this.blockchainMainService.getTokenPrice(isEVM ? 'ETH' : 'SOL'),
        ]);

        await ctx.editMessageText(
          `🚫 Insufficient Funds\n` +
            `Transaction failed due to insufficient funds. Check your balance and try again.\n\n` +
            `---\n\n` +
            `<strong>💸 Balance: </strong>${formatCurrency(+balance.balance * +solanaBalance)} / ${balance.balance} ${balance.symbol}\n\n` +
            responseSwap.url,
          {
            message_id,
            parse_mode: 'HTML',
          },
        );
        await ctx.scene?.exit();
        return;
      }

      await ctx.editMessageText(
        `🚫 Swap Failed\n` +
          `Unable to complete swap. Check bot settings and network congestion then try again.\n\n` +
          responseSwap.url,
        {
          message_id,
        },
      );
      await ctx.scene?.exit();
      return;
    }

    await ctx.editMessageText(
      `⏳ Processing transaction... \n${responseSwap.url}`,
      {
        link_preview_options: {
          is_disabled: true,
        },
        message_id,
      },
    );

    this.analyticsService.trackEvent(ANALYTICS_TRADE, {
      token,
      solAmount: isBuy ? solAmount : 0,
      tokenAmount: !isBuy ? solAmount : 0,
      side: isBuy ? 'buy' : 'sell',
      userId: ctx.from.id,
    });

    // Create job for confirm swap
    await this.blockchainQueueService.swapConfirm({
      token,
      symbol,
      side: isBuy ? 'buy' : 'sell',
      userId: ctx.from.id.toString(),
      botId: ctx.me.username,
      txnId: responseSwap.txId,
      amountIn: responseSwap.amountIn,
      amountOut: responseSwap.amountOut,
      groupId: `${ctx.chat.id}`,
      messageId: `${message_id}`,
      username: ctx.from?.username ?? ctx.from?.first_name ?? '',
    });

    await ctx.scene?.exit();
  }
}
