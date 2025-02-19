import { Update } from '@grammyjs/nestjs';
import { PORTFOLIO_SCENE } from '../constants';
import { AccountService } from '@/account/account.service';
import { formatCurrency, t } from '../../util';
import {
  DexScreenerService,
  EMPTY_TOKEN,
} from '@/dexscreener/dexscreener.service';

import BigNumber from 'bignumber.js';
import { mainLongMenuKeyboard } from '../common/keyboards';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import {
  getGatefiURL,
  isAccountEnabled,
  sortByTokenAmount,
} from '../helpers/helpers';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Scene as GrammyScene } from 'grammy-scenes';
import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { Token } from '../../dexscreener/dto/token.dto';
import { ConfigService } from '@nestjs/config';

@Update()
@Scene(PORTFOLIO_SCENE)
export class PortfolioScene {
  scene: GrammyScene;
  constructor(
    private readonly accountService: AccountService,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly dexScreenerService: DexScreenerService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    console.time('portfolio');
    ctx.session.current_scene = PORTFOLIO_SCENE;

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: PORTFOLIO_SCENE,
      userId: ctx.from.id,
    });

    if (!isAccountEnabled(ctx)) return;

    const account = await this.accountService.createOrGetAccount(
      `${ctx.from.id}`,
      ctx.from.username,
      { groupId: `${ctx.chat.id}` },
    );

    console.time('portfolio balances');
    const [solana, solanaTokens, solanaBalance] = await Promise.all([
      this.blockchainMainService.getBalance(account.walletPubKey),
      this.blockchainMainService.getAllTokenAccounts(account.walletPubKey), //this.blockchainMainService.getTokenMetadataByOwner(account.walletPubKey),
      this.blockchainMainService.getTokenPrice('SOL'),
    ]);
    console.timeEnd('portfolio balances');

    let evmMessage = '';
    let evmTokens = [];

    if (
      this.configService.get('EVM_ENABLED') === 'true' &&
      account.xWalletPubKey
    ) {
      const [eth, tokens, ethBalance] = await Promise.all([
        this.blockchainMainService.getBalance(account.xWalletPubKey),
        this.blockchainMainService.getAllTokenAccounts(account.xWalletPubKey),
        this.blockchainMainService.getTokenPrice('ETH'),
      ]);

      evmTokens = tokens;

      let ethNetWorthUSD = new BigNumber(0);
      let ethNetWorthNative = new BigNumber(0);
      evmMessage += `\n\n`;
      evmMessage += `---\n\n💸 ETH Balance: <b>${formatCurrency(+eth.balance * +ethBalance)} / ${eth.balance} ETH</b>`;
      ethNetWorthUSD = ethNetWorthUSD.plus(+eth.balance * +ethBalance);
      ethNetWorthNative = ethNetWorthNative.plus(eth.balance);
      evmMessage += `\n💰Net Worth: <b>${formatCurrency(ethNetWorthUSD.toNumber())} / ${ethNetWorthNative.toFormat(4)} ETH</b>`;
    }

    // TODO: Optimise out zero token value
    const sortedSolanaTokens = sortByTokenAmount(solanaTokens, 'solana');
    const sortedEvmTokens = sortByTokenAmount(evmTokens, 'evm');

    const [allDexScreenerSolanaTokenData, allDexScreenerEvmTokenData] =
      await Promise.all([
        this.dexScreenerService.lookupToken(
          sortedSolanaTokens.map((t) => t.publicKey),
        ),
        this.dexScreenerService.lookupToken(
          sortedEvmTokens.map((t) => t.address),
        ),
      ]);

    const multipleTokenData = [
      ...allDexScreenerSolanaTokenData,
      ...allDexScreenerEvmTokenData,
    ].reduce(
      (acc, t) => {
        if (
          acc[t.baseToken.address] &&
          acc[t.baseToken.address].mktCap.value > t.mktCap.value
        )
          return acc;

        acc[t.baseToken.address] = t;

        return acc;
      },
      {} as Record<string, Token>,
    );

    let netWorthUSD = new BigNumber(0);
    let netWorthNative = new BigNumber(0);

    const solTokensMessages = await Promise.all(
      sortedSolanaTokens.map(async (t) => {
        const tokenData = multipleTokenData[t.publicKey] || EMPTY_TOKEN;

        let market = '';
        let valueBalanceUSD = new BigNumber(0);
        let decimals = 0;

        const mintInfo = t.token.mintInfo;
        if (mintInfo?.decimals > 0 && mintInfo?.decimals < 9) {
          decimals = mintInfo.decimals;
        }

        const walletBalance = new BigNumber(
          t.token.amount.toString(),
        ).dividedBy(decimals > 0 ? 10 ** decimals : LAMPORTS_PER_SOL);

        const balance = [
          `${walletBalance.toFormat(4)} ${tokenData.baseToken.symbol}`,
        ];
        try {
          market =
            `\n💲 Market Cap:  ${tokenData.mktCap.formatted} @ ${tokenData.priceUsd}` +
            `\n🔁 Volume 24h: ${tokenData.volume24h.formatted}` +
            `\n📈 5m: ${tokenData.change5m.formatted} | 6h:  ${tokenData.change6h.formatted} | 1h: ${tokenData.change1h.formatted}| 24h: ${tokenData.change24h.formatted}`;

          valueBalanceUSD = walletBalance.multipliedBy(tokenData.priceUsd);
          netWorthUSD = netWorthUSD.plus(valueBalanceUSD);
          const valueBalanceNative = walletBalance.multipliedBy(
            tokenData.priceNative,
          );
          netWorthNative = netWorthNative.plus(valueBalanceNative);

          balance.unshift(`${valueBalanceNative.toFormat(2)} SOL`);
          balance.unshift(`$${valueBalanceUSD.toFormat(2)}`);
        } catch (e) {
          market = '\n\t\t ⏳ Processing market data...\n';
          console.log('Error:', e);
        }

        return {
          t,
          tokenItem: (index) =>
            `<b>/${index} <a href="https://birdeye.so/token/${t.publicKey}?chain=solana">${tokenData.baseToken.name}</a></b>\n` +
            '💰 <b>' +
            balance.join(' / ') +
            '</b>' +
            `${market}\n\n`,
          tokenBalanceUSD: valueBalanceUSD,
        };
      }),
    );

    let solTokensItemSorted = solTokensMessages.sort((a, b) => {
      return b.tokenBalanceUSD.toNumber() - a.tokenBalanceUSD.toNumber();
    });

    solTokensItemSorted = solTokensItemSorted.filter((t) => {
      // TODO: Use the value set in the settings panel
      // Hide tokens with less than $0.01 value
      return t.tokenBalanceUSD.gt(0.05);
    });

    const solTokenItemSortedContent = solTokensItemSorted.map((t, i) => {
      return t.tokenItem(i + 1);
    });

    // const formattedTokens =
    //   tokenItemSortedContent.join('\n') ||
    //   'You currently have no tokens. You can buy some by clicking /ninja. \n';

    const solanaTokenMessages = `🌌 Solana Tokens\n${solTokenItemSortedContent.join('\n') || 'You currently have no Solana tokens. You can buy some by clicking /ninja.'}\n`;

    const evmTokensMessages = await Promise.all(
      sortedEvmTokens.map(async (t) => {
        const tokenData = multipleTokenData[t.address] || EMPTY_TOKEN;
        let market = '';
        try {
          market =
            `\n💲 Market Cap: ${tokenData.mktCap.formatted} @ ${tokenData.priceUsd}` +
            `\n🔁 Volume 24h: ${tokenData.volume24h.formatted}` +
            `\n📈 5m: ${tokenData.change5m.formatted} | 6h: ${tokenData.change6h.formatted} | 1h: ${tokenData.change1h.formatted} | 24h: ${tokenData.change24h.formatted}`;
        } catch (e) {
          market = '\n\t\t ⏳ Processing market data...\n';
          console.log('Error:', e);
        }

        const valueUSD = new BigNumber(t.valueUsd || tokenData.priceUsd);
        netWorthUSD = netWorthUSD.plus(valueUSD);

        return {
          t: t,
          tokenItem: (index) => {
            return (
              `<b>/${solTokensItemSorted.length + (index + 1)} <a href="https://birdeye.so/token/${t.address}?chain=evm">${t.name}</a></b>\n` +
              `💰 <b>$${valueUSD.toFormat(2)} / ${t.uiAmount.toFixed(4)} ${t.symbol}</b>${market}\n\n`
            );
          },
          tokenBalanceUSD: valueUSD,
        };
      }),
    );

    let evmTokensItemSorted = evmTokensMessages.sort((a, b) => {
      return b.tokenBalanceUSD.toNumber() - a.tokenBalanceUSD.toNumber();
    });

    evmTokensItemSorted = evmTokensItemSorted.filter((t) => {
      // TODO: Use the value set in the settings panel
      // Hide tokens with less than $0.01 value
      return t.tokenBalanceUSD.gt(0.05);
    });

    const evmTokenItemSortedContent = evmTokensItemSorted.map((t, i) => {
      return t.tokenItem(i);
    });

    ctx.session.data = {
      tokens: solTokensItemSorted
        .map((t) => t.t)
        .concat(evmTokensItemSorted.map((t) => t.t)),
    };

    // console.log('ctx.session.data', ctx.session.data);

    const evmTokenMessages =
      this.configService.get('EVM_ENABLED') === 'true'
        ? `🌍 Base Tokens\n${evmTokenItemSortedContent.join('\n') || 'You currently have no Base tokens. You can buy some by clicking /ninja.'}\n`
        : '';

    // let message = `🏯 Dojo Dashboard\n\n${solanaTokenMessages}`;

    let message = `${t('scene.portfolio.text.title')}\n\n${solanaTokenMessages}${evmTokenMessages}`;

    message += `---\n\n💸 SOL Balance: <b>${formatCurrency(+solana.balance * +solanaBalance)} / ${solana.balance} SOL</b>`;
    netWorthUSD = netWorthUSD.plus(+solana.balance * +solanaBalance);
    netWorthNative = netWorthNative.plus(solana.balance);
    message += `\n💰Net Worth: <b>${formatCurrency(netWorthUSD.toNumber())} / ${netWorthNative.toFormat(4)} SOL</b>`;
    message += evmMessage;

    await ctx.replyWithHTML(message, {
      link_preview_options: {
        is_disabled: true,
      },
      parse_mode: 'HTML',
      reply_markup: mainLongMenuKeyboard({
        gatefiURL: getGatefiURL({ account }),
        ninaModeActive: ctx.session.ninjaMode?.active ? true : false,
      }),
    });

    console.timeEnd('portfolio');
    await ctx.scene?.exit();
  }
}
