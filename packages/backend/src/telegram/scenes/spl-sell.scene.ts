import { Update } from '@grammyjs/nestjs';
import { Logger } from '@nestjs/common';
import { SELL_SPL_SCENE } from '../constants';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';

import { BlockchainService } from '../../blockchain/blockchain.service';
import { AccountService } from '@/account/account.service';

import { sortByTokenAmount } from '../helpers/helpers';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { InlineKeyboard } from 'grammy';
import { t } from '../../util';

@Update()
@Scene(SELL_SPL_SCENE)
export class SellSLPScene {
  logger = new Logger(SellSLPScene.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @SceneEnter()
  async onSceneEnter(ctx) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: SELL_SPL_SCENE,
      userId: ctx.from.id,
    });

    const account = await this.accountService.get(`${ctx.from.id}`);

    const solanaTokens = await this.blockchainService.getTokenMetadataByOwner(
      account.walletPubKey,
    );

    const sortedTokens = sortByTokenAmount(solanaTokens, 'solana') || [];

    const inlineKeyboard = new InlineKeyboard();

    sortedTokens.forEach((token, idx) => {
      const tokenString = token.metadata
        ? `${token.metadata.symbol} - ${token.metadata.name}`
        : token.token.mint;

      inlineKeyboard.add(
        InlineKeyboard.text(tokenString, `CA_${token.token.mint}`),
      );

      if ((idx + 1) % 2 === 0) inlineKeyboard.row();
    });

    inlineKeyboard.row().add(InlineKeyboard.text('❎ Close', 'delete')).row();

    await ctx.reply(t('scene.sell.text.content'), {
      reply_markup: inlineKeyboard,
    });
  }
}
