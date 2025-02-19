import {
  Update,
  Start,
  Command,
  CallbackQuery,
  InjectBot,
  Hears,
  On,
} from '@grammyjs/nestjs';
import { Bot, Context } from 'grammy';

import { Logger, UseFilters } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { formatCurrency } from '../util';

import { XAmountSPLScene } from './scenes/spl-x-amount.scene';
import { Markup } from 'telegraf';
import {
  SINGLE_SLP_SCENE,
  BUY_SPL_SCENE,
  WALLET_SCENE,
  TAX_SCENE,
  SENSEI_SCENE,
  SELL_SPL_SCENE,
  NINJA_MODE_SCENE,
  REFER_SCENE,
  CHAT_SCENE,
  SETTINGS_SCENE,
  PORTFOLIO_SCENE,
  WAITLIST_SCENE,
  NINJA_MODE_NEWS_SCENE,
  KAMIKAZE_SCENE,
  X_AMOUNT_SPL_SCENE,
  BOT_BACKUP_SCENE,
  ACTIVITY_SCENE,
  TOPUP_SCENE,
  SINGLE_MORE_SCENE,
  NINJA_TOKEN_ADDRESS,
  SOL_TRANSFER_SCENE,
} from './constants';

import { GrammyExceptionFilter } from './filters/grammy-exception.filter';
import { mainShortMenuKeyboard } from './common/keyboards';
import {
  getContractAddress,
  getGatefiURL,
  getReferralLink,
} from './helpers/helpers';

// Scene Test

import { PortfolioScene } from './scenes/portfolio.scene';
import { DEFAULT_SETTINGS } from '../account/types/settings.types';
import { BlockchainQueueService } from '../blockchain-queue/blockchain-queue.service';
import { BlockchainMainService } from '../blockchain-main/blockchain-main.service';
import { convertEvmTokenFromNative, isEVMAddress } from '../util';
import { WETH_CONTRACT_ADDRESS } from '../uniswap/constants';
import { isNumberString } from 'class-validator';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { NinjaModeScene } from './scenes/ninja-mode.scene';
import { SolTransferScene } from './scenes/sol-transfer.scene';

// Sign Up
// Wallet
// Transfer in
// View Balance
// Buy
// Sell

@Update()
@UseFilters(GrammyExceptionFilter)
export class TelegramUpdate {
  logger = new Logger(TelegramUpdate.name);
  constructor(
    private readonly accountService: AccountService,
    private readonly blockchainService: BlockchainService,
    private readonly blockchainQueueService: BlockchainQueueService,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly portfolioScene: PortfolioScene,
    private readonly xAmountScene: XAmountSPLScene,
    private readonly ninjaModeScene: NinjaModeScene,
    private readonly transferScene: SolTransferScene,
    @InjectBot() private readonly bot: Bot<Context>,
  ) {
    this.logger.debug(
      `Initializing`,
      this.bot.isInited() ? bot.botInfo.first_name : '(pending)',
    );
  }

  @Start()
  async attack(ctx: Context) {
    console.log('Start:', ctx.match);

    // @ts-ignore
    const referralId = getReferralLink(ctx.match);

    // @ts-ignore
    const contractAddress = getContractAddress(ctx.match);

    const account = await this.accountService.createOrGetAccount(
      `${ctx.from.id}`,
      ctx.from?.username || ctx.from?.first_name || `${ctx.from.id}`,
      { groupId: `${ctx.chat.id}`, referredBy: referralId },
    );

    // @ts-ignore
    if (!ctx?.session?.settings) {
      // @ts-ignore
      ctx.session.settings = account.settings || DEFAULT_SETTINGS;
    }

    const solana = await this.blockchainMainService.getBalance(
      account.walletPubKey,
    );

    const isAccountEnabled =
      account.enabledAccount === undefined || account.enabledAccount;

    if (contractAddress && isAccountEnabled) {
      const token =
        await this.blockchainService.getTokenFromString(contractAddress);

      if (token) {
        // @ts-ignore
        await ctx.scenes.enter(SINGLE_SLP_SCENE, {
          token: token,
        });

        return;
      }
    }

    await ctx.replyWithVideo(
      'https://firebasestorage.googleapis.com/v0/b/solarsol2024.appspot.com/o/ninja-welcome.mp4?alt=media&token=07f279e0-f5f6-42d7-ac51-e4087ea1a737',
      {
        parse_mode: 'HTML',
        reply_markup: mainShortMenuKeyboard({
          gatefiURL: getGatefiURL({ account }),
        }),
        caption:
          "WELCOME TO SHINOBI ⛩️ \n\nSwift trading within the shadow's reach, initiate /attack to unveil the main dojo and harness all our features - rapid exchanges, emerging token signals, stealth sniping.\n\n" +
          `You currently have  ${solana.balance || 0} SOL balance. To get started with trading, send some SOL to your wallet address:\n\n` +
          `<code>${account.walletPubKey}</code> (tap to copy)\n\n` +
          `Once done tap refresh and your balance will appear here.\n\n` +
          `For more info on your wallet and to retrieve your private key, tap the wallet button below. We guarantee the safety of user funds on SHINOBI, but if you expose your private key your funds will not be safe.`,
      },
    );
  }

  async validateBalance(
    ctx: any,
    usdValue: number,
    amount: number,
    tokenValue: number,
    wallet: string,
    solBalance: number,
    chainSymbol: string,
  ) {
    if (usdValue < amount * +tokenValue) {
      await ctx.reply(
        `🚫 You don't have enough balance to perform this action. Your balance at ${wallet} is ${solBalance} ${chainSymbol} which is worth ${formatCurrency(usdValue)} USD.`,
      );
      await ctx.scene?.exit();
      return false;
    }
    return true;
  }

  async enabledAccount(ctx: any) {
    const enabled = ctx.session.account ? ctx.session.account.enabled : false;

    if (!enabled) {
      const account = await this.accountService.createOrGetAccount(
        `${ctx.from.id}`,
        ctx.from?.username || ctx.from?.first_name || `${ctx.from.id}`,
        { groupId: `${ctx.chat.id}` },
      );

      /**
       * to maintain compatibility with users already on the platform, enabled
       * accounts are those where the property does not exist (undefined) or
       * if it does exist and is true
       */
      const isAccountEnabled =
        account.enabledAccount === undefined || account.enabledAccount;

      ctx.session.account = {
        enabled: isAccountEnabled,
      };

      if (!isAccountEnabled) {
        // Set the bot commands

        await ctx.scenes.enter(WAITLIST_SCENE);

        return isAccountEnabled;
      }

      return isAccountEnabled;
      // }
    }
    return enabled;
  }

  @Command(['greeting'])
  async greeting(ctx) {
    await ctx.conversation.enter('greeting');
  }

  @Command(['snipe'])
  async snipe(ctx) {
    const job = await this.blockchainQueueService.createSwap({
      userId: ctx.from.id,
      groupId: ctx.chat.id,
      botId: ctx.botId,
      symbol: 'Ninja',
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
      solAmount: 0.01,
      priorityFeeAmount: Number(
        ctx?.session?.settings?.transaction_priority_amount ||
          DEFAULT_SETTINGS.transaction_priority_amount,
      ),
      // swapProvider: 'sumo',
    });
    await ctx.reply('Snipe job created: ' + job.id);
  }

  @Command(['dojo', 'home', 'attack', 'all', 'exit'])
  @CallbackQuery(['dojo', 'home', 'attack', 'all', 'exit'])
  async wallet(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    await this.portfolioScene.onSceneEnter(ctx);
  }

  @CallbackQuery(['delete'])
  async delete(ctx) {
    await ctx.deleteMessage();
  }

  @CallbackQuery(['refresh'])
  async refresh(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    await ctx.deleteMessage();
    return await this.portfolioScene.onSceneEnter(ctx);
  }

  @CallbackQuery(['refresh_token'])
  async refreshToken(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    await ctx.deleteMessage();
    await ctx.scenes.enter(SINGLE_SLP_SCENE, {
      token: ctx.session.data.token,
    });
  }

  @Command(['wallet'])
  @CallbackQuery(['wallet'])
  async manageWallet(ctx) {
    await ctx.scenes.enter(WALLET_SCENE);
  }

  @Command(['sensei'])
  @CallbackQuery(['sensei'])
  async manageSensei(ctx) {
    await ctx.scenes.enter(SENSEI_SCENE);
  }

  @Command(['ninja_mode'])
  @CallbackQuery(['ninja_mode'])
  async goToNinjaMode(ctx) {
    if (!(await this.enabledAccount(ctx))) return;
    await ctx.scenes.enter(NINJA_MODE_SCENE);
    return;
  }

  @Command(['ninja_mode_news'])
  @CallbackQuery(['ninja_mode_news'])
  async goToNinjaModeNews(ctx) {
    await ctx.scenes.enter(NINJA_MODE_NEWS_SCENE);
    return;
  }

  @Command(['tax'])
  @CallbackQuery(['tax'])
  async manageTax(ctx) {
    await ctx.scenes.enter(TAX_SCENE);
  }

  @Command(['refer', 'referrals'])
  @CallbackQuery(['refer', 'referrals'])
  async manageRefer(ctx) {
    await ctx.scenes.enter(REFER_SCENE);
  }

  @Command(['chat'])
  @CallbackQuery(['chat'])
  async manageChat(ctx) {
    ctx.scenes.enter(CHAT_SCENE);
  }

  @Command(['settings'])
  @CallbackQuery(['settings'])
  async manageSettings(ctx) {
    await ctx.scenes.enter(SETTINGS_SCENE);
  }

  @Command(['buy'])
  @CallbackQuery(['buy'])
  async goToBuyScene(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    await ctx.scenes.enter(BUY_SPL_SCENE);
  }

  @Command(['sell'])
  @CallbackQuery(['sell'])
  async goToSellScene(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    await ctx.scenes.enter(SELL_SPL_SCENE);
  }

  @Command(['ninja'])
  @CallbackQuery(['ninja_single', 'ninja'])
  async ningleSingle(ctx) {
    if (!(await this.enabledAccount(ctx))) return;

    const token = await this.blockchainService.getTokenFromString(
      // Ninja Token
      '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
    );
    await ctx.scenes.enter(SINGLE_SLP_SCENE, {
      token: token,
    });
  }

  @Command(['apps'])
  @CallbackQuery(['apps'])
  async manageApps(ctx) {
    if (process.env.MINI_APPS) {
      await ctx.reply(
        'Apps are coming soon, Ninja. Stay tuned to the dojo for updates.',
        Markup.inlineKeyboard([
          Markup.button.webApp('Launch', process.env.MINI_APPS_URL),
        ]),
      );

      return;
    }

    await ctx.reply(
      'Apps are coming soon, Ninja. Stay tuned to the dojo for updates.',
    );
  }

  @Command(['kamikaze'])
  @CallbackQuery(['kamikaze'])
  async manageKamikaze(ctx) {
    await ctx.scenes.enter(KAMIKAZE_SCENE);
  }

  @Command(['bots'])
  @CallbackQuery(['bots'])
  async manageBotsBackup(ctx) {
    await ctx.scenes.enter(BOT_BACKUP_SCENE);
  }

  @Command(['topup'])
  @CallbackQuery(['topup'])
  async manageTopup(ctx) {
    await ctx.scenes.enter(TOPUP_SCENE);
  }

  @Command(['activity'])
  @CallbackQuery(['activity'])
  async manageActivity(ctx) {
    await ctx.scenes.enter(ACTIVITY_SCENE);
  }

  @Command(['single_more'])
  @CallbackQuery(['single_more'])
  async manageSingleMore(ctx) {
    await ctx.scenes.enter(SINGLE_MORE_SCENE);
  }

  @CallbackQuery(['single_more_back'])
  async manageSingleMoreBack(ctx) {
    await ctx.deleteMessage();
  }

  @On('callback_query')
  async onGlobalSingleCallbacks(ctx, next) {
    const callbackQuery = ctx.callbackQuery.data;
    // SEE - packages/backend/src/telegram/scenes/spl-single.scene.ts
    if (!callbackQuery.startsWith('SP_')) {
      if (callbackQuery.startsWith('CA_')) {
        const [, token] = callbackQuery.split('_');
        await this.goToSingleToken(ctx, token);
        return;
      }

      return next();
    }
    // SP_BY_LT_CA_2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT
    const [action, ca] = callbackQuery.split('_CA_');

    if (ca === 'So11111111111111111111111111111111111111112') {
      await ctx.reply('🚫 Input and output mints are not allowed to be equal');
      await ctx.scene?.exit();
      return next();
    }

    console.log('onGlobalSingleCallbacks, action: ' + action + ' ca: ' + ca);
    // await ctx.reply(
    //   'onGlobalSingleCallbacks, action: ' + action + ' ca: ' + ca,
    // );

    // TODO send all BY, SL X and LEFT / RIGHT BUTTON to spl-x scene with then a data amount in to skip the amount questions.

    const isEvm = isEVMAddress(ca);

    const settings = ctx.session.settings || DEFAULT_SETTINGS;
    //https://docs.base.org/docs/base-contracts/
    const baseMint = isEvm
      ? WETH_CONTRACT_ADDRESS
      : 'So11111111111111111111111111111111111111112';
    const isBuy = callbackQuery.includes('SP_BY');
    const chainSymbol = isEvm ? 'ETH' : 'SOL';
    const inputMint = isBuy ? baseMint : ca;
    const outputMint = isBuy ? ca : baseMint;
    const isSniping = this.blockchainMainService.getTradeMethod(ctx);
    const userId = String(ctx.from.id);
    let amount = 0;
    const userWallet = await this.accountService.getAccountWallet(
      String(userId),
    );
    const userAddress = isEvm
      ? userWallet.evm.address
      : userWallet.solana.publicKey.toString();

    const [tokenBalance, tokenValue] = await Promise.all([
      this.blockchainMainService.getBalance(userAddress),
      this.blockchainMainService.getTokenPrice(chainSymbol),
    ]);

    const usdValue = +tokenBalance.balance * +tokenValue;
    if (
      callbackQuery.includes('SP_BY_RT') ||
      callbackQuery.includes('SP_SL_RT')
    ) {
      amount = isBuy ? settings.buy_button_right : settings.sell_button_right;
      if (isBuy) {
        const validBalance = await this.validateBalance(
          ctx,
          usdValue,
          amount,
          +tokenValue,
          userAddress,
          +tokenBalance.balance,
          chainSymbol,
        );
        if (!validBalance) return;
      }
    } else if (
      callbackQuery.includes('SP_BY_LT') ||
      callbackQuery.includes('SP_SL_LT')
    ) {
      amount = isBuy ? settings.buy_button_left : settings.sell_button_left;
      if (isBuy) {
        const validBalance = await this.validateBalance(
          ctx,
          usdValue,
          amount,
          +tokenValue,
          userAddress,
          +tokenBalance.balance,
          chainSymbol,
        );
        if (!validBalance) return;
      }
    }

    await ctx.scene?.exit();
    await ctx.scenes.enter(X_AMOUNT_SPL_SCENE, {
      token: ca,
      isBuy,
      inputMint,
      outputMint,
      isSniping,
      userId,
      amount,
    });
  }

  @On('::bot_command')
  async onSearchSPLToken(ctx, next) {
    //
    // README - https://github.com/IlyaSemenov/grammy-scenes?tab=readme-ov-file#scenes
    // TODO - could we move to decorator as well?
    // @SceneOn('message')
    //
    console.log(' ctx.session.current_scene', ctx.session.current_scene);
    if (ctx.session.current_scene === NINJA_MODE_SCENE) {
      await this.ninjaModeScene.setMetaTags(ctx);
      return;
    }

    const text = ctx.message.text || ctx.update.message.text;
    if (!text?.match(/^\/\d+$/)) {
      return next();
    }

    console.log('PORTFOLIO SCENE - message', text);

    const command = text?.match(/^\/\d+$/);

    const index = command ? +command[0].substring(1) - 1 : null;

    // @ts-ignore
    const tokens = ctx.session?.data?.tokens || [];

    // console.log('Tokens:', tokens, index);
    const token = tokens[index];

    console.log('index:', index, 'token', token, token?.publicKey);
    if (!token?.publicKey && !token?.address) {
      await ctx.reply(
        'Token not found Ninja, head back to the /dojo and try again.',
      );

      await ctx.scenes.enter(PORTFOLIO_SCENE);

      return;
    }

    await ctx.scenes.enter(SINGLE_SLP_SCENE, {
      token: token?.publicKey || token?.address,
    });
  }

  // @On(['callback_query', '::bot_command'])
  // async globalCommands(ctx) {
  //   // await ctx.reply('globalCommands');
  // }

  @Hears(/^-?\d+(\.\d+)?$/)
  async hearsAmount(ctx) {
    const text =
      ctx?.update?.message?.text?.trim() || ctx.message?.text?.trim();

    if (!text || !isNumberString(text)) return;

    const { current_scene } = ctx.session;

    this.logger.debug('current_scene:', current_scene);
    this.logger.debug('value:', text);

    if (current_scene === SETTINGS_SCENE) {
      const current_command = ctx.session?.settings?.current_command || '';

      this.logger.debug('current_command:', current_command);

      if (!current_command) return;

      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        [current_command]: Number(text),
      };

      if (current_command === 'transaction_priority_amount') {
        ctx.session.settings = {
          ...(ctx.session.settings || DEFAULT_SETTINGS),
          transaction_priority: 'custom',
        };
      }

      const from = ctx.from || ctx.callback_query.from;

      await this.accountService.update(from.id.toString(), {
        settings: ctx.session.settings,
      });

      ctx.session.current_scene = '';
      await ctx.scenes.enter(SETTINGS_SCENE);
    } else if (current_scene === KAMIKAZE_SCENE) {
      ctx.session.current_scene = '';
      console.log(ctx.session.data.tokens);

      const ninjaToken = ctx.session.data.tokens.find(
        (token) => token.publicKey === NINJA_TOKEN_ADDRESS,
      );

      if (!ninjaToken) {
        await ctx.reply(
          '$NINJA token not found. Head back to the /dojo and try again.',
        );

        return;
      }

      console.log('BURN AMOUNT:', text);
      const { message_id } = await this.bot.api.sendMessage(
        ctx.chat.id,
        'Initiating burning mode',
      );

      console.log('message_id', message_id);
      const account = await this.accountService.get(`${ctx.from.id}`);
      let amount = Number(text);

      if (ctx.session.kamikaze_type === 'percentage') {
        amount = (amount / 100) * (ninjaToken.token.amount / LAMPORTS_PER_SOL);
      }

      const response = await this.blockchainService.burn({
        walletPrivateKey: account.walletPrivateKey,
        decimals:
          ninjaToken.mint.decimals || ninjaToken.token.mintInfo.decimals,
        amount,
      });

      if (response.error) {
        const message =
          ` ${response.error ? '🚫 Burn failed' : '🔥 SUCCESSFUL BURN!'}\n\n` +
          response.message;

        return await this.bot.api.editMessageText(
          ctx.chat.id,
          message_id,
          message,
          {
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
      }

      await this.blockchainQueueService.burnConfirm({
        amount,
        botId: ctx.me.username,
        groupId: `${ctx.chat.id}`,
        messageId: `${message_id}`,
        symbol: ninjaToken.token.symbol,
        token: ninjaToken.publicKey,
        txId: response.txId,
        userId: `${ctx.from.id}`,
      });
    } else if (current_scene === NINJA_MODE_SCENE) {
      await this.ninjaModeScene.setMetaTags(ctx);
    } else if (current_scene === X_AMOUNT_SPL_SCENE) {
      const { isBuy, inputMint, outputMint } = ctx.session.x;
      if (isBuy) {
        const userId = String(ctx.from.id);
        let amount = 0;

        const isEvm = isEVMAddress(inputMint) || isEVMAddress(outputMint);
        const chainSymbol = isEvm ? 'ETH' : 'SOL';

        const userWallet = await this.accountService.getAccountWallet(
          String(userId),
        );

        const userAddress = isEvm
          ? userWallet.evm.address
          : userWallet.solana.publicKey.toString();

        const [tokenBalance, tokenValue] = await Promise.all([
          this.blockchainMainService.getBalance(userAddress),
          this.blockchainMainService.getTokenPrice(chainSymbol),
        ]);

        const usdValue = +tokenBalance.balance * +tokenValue;
        ctx.session.current_scene = '';
        amount = Number(text);
        const validBalance = await this.validateBalance(
          ctx,
          usdValue,
          amount,
          +tokenValue,
          userAddress,
          +tokenBalance.balance,
          chainSymbol,
        );
        if (!validBalance) return;
      }
      await this.xAmountScene.handleSwap(ctx, Number(text));
    } else if (current_scene === SOL_TRANSFER_SCENE) {
      await this.transferScene.requestAmount(ctx);
    }
  }

  @Hears(/^.*$/)
  async hears(ctx) {
    if (ctx.session.current_scene === NINJA_MODE_SCENE) {
      await this.ninjaModeScene.setMetaTags(ctx);
      return;
    } else if (ctx.session.current_scene === SOL_TRANSFER_SCENE) {
      await this.transferScene.requestAmount(ctx);
      return;
    }

    await this.goToSingleToken(ctx);
  }

  async goToSingleToken(ctx, tokenAddress?: string) {
    if (!(await this.enabledAccount(ctx))) return;

    const ca = ctx.message?.text || tokenAddress;
    const token = await this.blockchainMainService.getTokenFromString(ca);
    this.logger.debug('Token:', token, ca);

    if (token) {
      await ctx.scenes.enter(SINGLE_SLP_SCENE, {
        token: convertEvmTokenFromNative(token),
      });
    } else {
      await ctx.reply(
        `Token not found. Make sure address (${ca}) is correct. You can enter a token address or a Solscan/Birdeye link.`,
      );
    }
  }
}
