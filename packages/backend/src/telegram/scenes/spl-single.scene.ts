import { SINGLE_SLP_SCENE } from '../constants';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Logger } from '@nestjs/common';

import { BlockchainService } from '../../blockchain/blockchain.service';
import { AccountService } from '../../account/account.service';
import { DexScreenerService } from '../../dexscreener/dexscreener.service';
import {
  convertEvmTokenFromNative,
  isEVMAddress,
  resolve,
  t,
} from '../../util';
import BigNumber from 'bignumber.js';
import { z } from 'zod';
import { formatCurrency } from '../../util';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { isAccountEnabled } from '../helpers/helpers';
import { AnalyticsService } from '../../analytics/analytics.service';
import {
  ANALYTICS_SCENE_VIEW,
  ANALYTICS_SINGLE_SLP,
} from '../../analytics/analytics.types';
import { AccountSchema } from '@/account/entities/account.schema';
import { DEFAULT_SETTINGS } from '@/account/types/settings.types';

import debug from 'debug';
import { InjectBot, Update } from '@grammyjs/nestjs';
import { InlineKeyboard } from 'grammy';
import { Scene as GrammyScene } from 'grammy-scenes';
import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';

const log = debug('SingleSPLScene');

const logger = new Logger('SingleSPLScene');

type SingleSPLKeyboardMenuInput = {
  tokenId: string;
  twitter: string;
  website: string;
  telegram: string;
  account: z.infer<typeof AccountSchema>;
  canSell: boolean;
};

const createCallback = (ca) => (command) => `SP_${command}_CA_${ca}`;

const keyboard = ({
  tokenId,
  website,
  twitter,
  telegram,
  account,
  canSell,
}: SingleSPLKeyboardMenuInput) => {
  const settings = account.settings || DEFAULT_SETTINGS;
  const cb = createCallback(tokenId);
  const chainSymbol = isEVMAddress(tokenId) ? 'ETH' : 'SOL';
  const chain = isEVMAddress(tokenId) ? 'base' : 'solana';
  const explorer = isEVMAddress(tokenId)
    ? `https://basescan.org/address/${tokenId}`
    : `https://solscan.io/token/${tokenId}`;
  const inlineKeyboard = new InlineKeyboard().row(
    InlineKeyboard.text(
      `🛒 Buy ${settings.buy_button_left} ${chainSymbol}`,
      cb('BY_LT'), // BUY LEFT BUTTON
    ),
    InlineKeyboard.text(
      `🛒 Buy ${settings.buy_button_right} ${chainSymbol}`,
      cb('BY_RT'), // BUY RIGHT BUTTON
    ),
    InlineKeyboard.text(`🛒 Buy X ${chainSymbol}`, cb('BY_X')),
  );
  if (canSell) {
    inlineKeyboard.row(
      InlineKeyboard.text(`💰 Sell ${settings.sell_button_left}%`, cb('SL_LT')), // SELL LEFT BUTTON
      InlineKeyboard.text(
        `💰 Sell ${settings.sell_button_right}%`,
        cb('SL_RT'), // SELL RIGHT BUTTON
      ),
      InlineKeyboard.text('💰 Sell X%', cb('SL_X')),
    );
  }
  inlineKeyboard.row(
    InlineKeyboard.url('🔎 Explorer', explorer),
    InlineKeyboard.url(
      '🐦‍⬛ Birdeye',
      `https://birdeye.so/token/${tokenId}?chain=${chain}`,
    ),
    InlineKeyboard.url(
      '📈 Dexscreener',
      `https://dexscreener.com/${chain}/${tokenId}`,
    ),
  );

  if (website || telegram || twitter) {
    inlineKeyboard.row(
      InlineKeyboard.url('🔗 Website', website),
      InlineKeyboard.url('🐤 Twitter', twitter),
      InlineKeyboard.url('💬 Telegram', telegram),
    );
  }

  inlineKeyboard
    .row(InlineKeyboard.text('♾️️ More', 'single_more'))
    .row(
      InlineKeyboard.text(t('general.buttons.back'), 'dojo'),
      InlineKeyboard.text('🔁 Refresh', 'refresh_token'),
    );

  return inlineKeyboard;
};

@Update()
@Scene(SINGLE_SLP_SCENE)
export class SingleSPLScene {
  scene: GrammyScene;
  private account: z.infer<typeof AccountSchema>;

  constructor(
    @InjectBot()
    private readonly blockchainService: BlockchainService,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly accountService: AccountService,
    private readonly dexScreenerService: DexScreenerService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @SceneEnter()
  async onSingleToken(ctx): Promise<any> {
    try {
      if (!isAccountEnabled(ctx)) return;

      ctx.session.current_scene = SINGLE_SLP_SCENE;

      this.account = await this.accountService.createOrGetAccount(
        `${ctx.from.id}`,
        ctx.from?.username || ctx.from?.first_name || `${ctx.from.id}`,
        { groupId: `${ctx.chat.id}` },
      );

      const tokenMessage = ctx.scene.arg?.token;
      log('tokenMessage', tokenMessage);

      await this.analyticsService.trackEvent(ANALYTICS_SINGLE_SLP, {
        token: tokenMessage,
        userId: ctx.from.id,
      });

      let token =
        await this.blockchainMainService.getTokenFromString(tokenMessage);

      if (!token) {
        await ctx.reply(
          `Token not found. Make sure address (${ctx.message?.text}) is correct. You can enter a token address or a Solscan/Birdeye link.`,
        );

        return ctx.scene.exit();
      }

      const walletPubKey = isEVMAddress(token)
        ? this.account.xWalletPubKey
        : this.account.walletPubKey;
      const chainSymbol = isEVMAddress(token) ? 'ETH' : 'SOL';
      const chain = isEVMAddress(token) ? 'base' : 'solana';
      token = convertEvmTokenFromNative(token);

      const [
        tokenBalance,
        tokenMetadata,
        // tokenValue,
        [tokenData],
        tokenValue,
      ] = await Promise.all([
        this.blockchainMainService.getBalance(walletPubKey),
        this.blockchainMainService.getMetadataByToken(token),
        // this.blockchainService.getTokenPrice(token),
        this.dexScreenerService.lookupToken(token),
        this.blockchainMainService.getTokenPrice(chainSymbol),
      ]);

      let valueBalanceUSD = new BigNumber(0);
      let assetAmount = new BigNumber(0);
      const [error, asset] = await resolve(
        this.blockchainMainService.getTokenAccountBalance(
          token === '0x4200000000000000000000000000000000000006'
            ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            : token,
          walletPubKey,
        ),
      );

      let valueBalance = '';
      const balance = [];
      // get single holding value
      if (!error) {
        assetAmount = new BigNumber(asset.token.amount.toString());

        if (!isEVMAddress(token)) {
          const decimals = asset.mint?.decimals;

          assetAmount = assetAmount = assetAmount.dividedBy(
            decimals > 0 ? 10 ** decimals : LAMPORTS_PER_SOL,
          );
        }

        balance.push(
          `${assetAmount.toFormat(4)} ${tokenMetadata?.metadata?.symbol}`,
        );
        valueBalanceUSD = assetAmount.multipliedBy(tokenData.priceUsd);

        const valueBalanceNative = assetAmount.multipliedBy(
          tokenData.priceNative,
        );

        balance.unshift(`${valueBalanceNative.toFormat(2)} ${chainSymbol}`);
        balance.unshift(`$${valueBalanceUSD.toFormat(2)}`);
        valueBalance = `\n💰 Value: <b>${balance.join(' / ')}</b> `;
      }

      ctx.session.settings = this.account.settings || DEFAULT_SETTINGS;

      ctx.session.data = {
        tokens: ctx.session.data?.tokens || [],
        amountOwned: assetAmount.toFixed(),
        token: tokenMessage,
        symbol: tokenMetadata.metadata.symbol,
        name: tokenMetadata.metadata.name,
      };

      const market =
        `\n💲 Market Cap:  ${tokenData.mktCap.formatted} @ ${tokenData.priceUsd}` +
        `\n🔁 Volume 24h: ${tokenData.volume24h.formatted}` +
        `\n📈 5m: ${tokenData.change5m.formatted} | 6h:  ${tokenData.change6h.formatted} | 1h: ${tokenData.change1h.formatted}| 24h: ${tokenData.change24h.formatted}`;

      await ctx.replyWithHTML(
        `<b>${tokenMetadata.metadata.symbol} / <a href="https://birdeye.so/token/${tokenMetadata.publicKey}?chain=${chain}">${tokenMetadata.metadata.name}</a> <code>${tokenMetadata.publicKey}</code></b>\n` +
          valueBalance +
          market +
          '\n\n---\n\n' +
          `💰 Balance: <b>${assetAmount.toFormat()} ${tokenMetadata?.metadata?.symbol}</b>\n` +
          `💸 ${chainSymbol} Balance: <b>${formatCurrency(+tokenBalance.balance * +tokenValue)} / ${tokenBalance.balance} ${chainSymbol}</b>\n\n` +
          `Share and Refer: <a href="${process.env.REFERRAL_URL || ''}?start=ref_${this.account.referralId}_ca_${tokenMetadata.publicKey}">⚡️Trade ${tokenMetadata.metadata.symbol} on Ninja</a>`,
        {
          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: true,
          },
          reply_markup: keyboard({
            account: this.account,
            telegram: tokenData?.telegram,
            tokenId: tokenMetadata.publicKey || tokenMessage,
            twitter: tokenData?.twitter,
            website: tokenData?.website,
            canSell: !!asset,
          }),
        },
      );

      await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
        scene: SINGLE_SLP_SCENE,
      });

      return ctx.scene.exit();
    } catch (e) {
      logger.error(e, 'SINGLE_SLP_SCENE_ERROR');
      console.log(e);
      await ctx.reply('Something went wrong');
      return ctx.scene.exit();
    }
  }

  getAmountFromButtonSettings(
    settings,
    buttonCallbackCommand,
    { isSniping, amountOwned },
  ) {
    const buttonMap = {
      BUY_LEFT_SOL: settings.buy_button_left,
      BUY_RIGHT_SOL: settings.buy_button_right,
      SELL_LEFT_TOK: settings.sell_button_left,
      SELL_RIGHT_TOK: settings.sell_button_right,
    };
    // sell button
    if (
      buttonCallbackCommand.includes(
        buttonMap.SELL_LEFT_TOK,
        buttonMap.SELL_RIGHT_TOK,
      )
    ) {
      let solAmount;
      if (isSniping) solAmount = solAmount / LAMPORTS_PER_SOL;
      // calculate the amount to sell
      solAmount = Math.round(
        amountOwned * (buttonMap[buttonCallbackCommand] / 100),
      );
      return solAmount;
    }

    // buy button
    return isSniping
      ? buttonMap[buttonCallbackCommand]
      : this.blockchainService.solanaToLamports(
          buttonMap[buttonCallbackCommand],
        );
  }
}
