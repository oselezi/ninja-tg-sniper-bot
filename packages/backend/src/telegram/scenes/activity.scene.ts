import { InjectBot, Update } from '@grammyjs/nestjs';
import { ACTIVITY_SCENE, PORTFOLIO_SCENE, WALLET_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AccountService } from '../../account/account.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';

import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { z } from 'zod';
import { AccountSchema } from '../../account/entities/account.schema';
import * as dayjs from 'dayjs';
import { Bot } from 'grammy';
import { Menu } from '@grammyjs/menu';
import { t } from '../../util';

@Update()
@Scene(ACTIVITY_SCENE)
export class ActivityScene {
  private account: z.infer<typeof AccountSchema>;
  private lastTx: string = '';
  private menu: Menu;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly blockchainService: BlockchainService,
    private readonly accountService: AccountService,
    @InjectBot() private readonly bot: Bot,
  ) {
    this.menu = new Menu('activity-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('⬇️ Load More', async (ctx: any) => {
        await ctx.editMessageText(
          `${t('scene.activity.text.title')}n\n ⏳ Loading...`,
          {
            parse_mode: 'HTML',
          },
        );

        const txs = await this.getTxList(this.lastTx);

        await ctx.editMessageText(
          `${t('scene.activity.text.title')}\n\n` + txs,
          {
            parse_mode: 'HTML',
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
      })
      .text('🔁 Refresh', async (ctx: any) => {
        await ctx.editMessageText(
          `${t('scene.activity.text.title')}\n\n ⏳ Loading...`,
          {
            parse_mode: 'HTML',
          },
        );

        const txs = await this.getTxList();
        await ctx.editMessageText(
          `${t('scene.activity.text.title')}\n\n` + txs,
          {
            parse_mode: 'HTML',
            link_preview_options: {
              is_disabled: true,
            },
          },
        );
      })
      .row()
      .text('💲️ Wallet️', async (ctx: any) => {
        await ctx?.scene?.exit();
        await ctx.scenes.enter(WALLET_SCENE);
      })
      .text(t('general.buttons.back'), async (ctx: any) => {
        await ctx?.scene?.exit();
        await ctx.scenes.enter(PORTFOLIO_SCENE);
      });

    this.bot.use(this.menu);
  }

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    this.account = await this.accountService.createOrGetAccount(
      `${ctx.from.id}`,
      ctx.from?.username || ctx.from?.first_name || `${ctx.from.id}`,
      { groupId: `${ctx.chat.id}` },
    );

    const enabled = ctx.session.account ? ctx.session.account.enabled : true;

    const txs = await this.getTxList();

    ctx.replyWithHTML(`${t('scene.activity.text.title')}\n\n` + txs, {
      reply_markup: enabled ? this.menu : null,
      link_preview_options: {
        is_disabled: true,
      },
    });

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: ACTIVITY_SCENE,
      userId: ctx.from.id,
    });
  }

  async getTxList(lastTx?: string) {
    const data = await this.blockchainService.getActivity(
      this.account.walletPubKey,
      5,
      lastTx,
    );

    return data
      .map((tx, idx) => {
        if (idx === data.length - 1) this.lastTx = tx.signature;

        return (
          `<i>${dayjs(tx.date).fromNow()}</i>\n` +
          `<a href="https://solscan.io/tx/${tx.signature}">https://solscan.io/tx/${tx.signature}</a>\n` +
          `---`
        );
      })
      .join('\n\n');
  }
}
