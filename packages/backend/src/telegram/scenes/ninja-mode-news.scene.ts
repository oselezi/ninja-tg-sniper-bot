import { InjectBot, Update } from '@grammyjs/nestjs';
import { Logger } from '@nestjs/common';
import { NINJA_MODE_NEWS_SCENE, PORTFOLIO_SCENE } from '../constants';

import { Scene, SceneEnter } from './library/decorators/scene.decorator';

import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { TradeNotificationsAnalysisService } from '../../trade-notifications-analysis/trade-notifications-analysis.service';
import { Bot, InlineKeyboard } from 'grammy';

import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import { DexScreenerService } from '../../dexscreener/dexscreener.service';
import { Menu } from '@grammyjs/menu';
import { t } from '../../util';
dayjs.extend(relativeTime);

enum CALLBACK_QUERY {
  LOAD_MORE = 'load_more',
  TRENDING_METAS = 'trending_metas',
  FILTER = 'filter',
  CLOSE = 'close',
  REFRESH = 'refresh_spy',
  BACK_TO_DOJO = 'back_to_dojo',
}

const DEFAULT_LIMIT = 8;

const DEFAULT_META_HEADER =
  '🔎 Meta Spy\n\n' + '<i>Tip: Tap address to buy token</i>\n\n';

type GetMetasParams = {
  limit: number;
  offset: number;
  filter?: 'all' | 'matched';
};

@Update()
@Scene(NINJA_MODE_NEWS_SCENE)
export class NinjaModeNewsScene {
  logger = new Logger(NinjaModeNewsScene.name);
  private menu: Menu;
  private page = 0;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly tradeNotificationsAnalysisService: TradeNotificationsAnalysisService,
    private readonly dexScreenerService: DexScreenerService,
    @InjectBot() private readonly bot: Bot,
  ) {
    const trendingMetasMenu = new Menu('ninjamode-news-trending-metas-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('❎ Close', async (ctx) => {
        await ctx.deleteMessage();
      })
      .text(t('general.buttons.back'), async (ctx: any) => {
        await ctx?.scene?.exit();
        await ctx.scenes.enter(PORTFOLIO_SCENE);
      });

    this.menu = new Menu('ninja-mode-news-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('🔄 Load More', async (ctx: any) => {
        this.page += 1;
        const filter = ctx?.session?.meta_spy?.filter || 'all';

        await ctx.editMessageText(
          `${'scene.meta.text.title'}\n\n ⏳ Loading...`,
          {
            parse_mode: 'HTML',
          },
        );

        const metas = await this.getMetas({
          limit: DEFAULT_LIMIT,
          offset: this.page * DEFAULT_LIMIT,
          filter,
        });

        if (!metas) {
          await ctx.editMessageText(
            `${'scene.meta.text.title'}\n\n No more metas.`,
            {
              parse_mode: 'HTML',
            },
          );

          return;
        }

        await ctx.editMessageText(DEFAULT_META_HEADER + `${metas}`, {
          parse_mode: 'HTML',
        });
      })
      .text('🔥 Trending Metas', async (ctx) => {
        const trends =
          await this.tradeNotificationsAnalysisService.getLatestTrend();

        await ctx.reply(
          `${t('scene.meta_trending_metas.text.title')}\n\n` +
            trends.description.replace(/^(.*?\|)/gm, '<strong>$1</strong>'),
          {
            parse_mode: 'HTML',
            reply_markup: trendingMetasMenu,
          },
        );
      })
      .row()
      .text(
        (ctx: any) => {
          const filter = ctx?.session?.meta_spy?.filter || 'all';

          return `Filter: ${filter === 'all' ? '🚀 All' : '🚨 Matches Only'}`;
        },
        async (ctx: any) => {
          await ctx.editMessageText(
            `${'scene.meta.text.title'}\n\n ⏳ Loading...`,
            {
              parse_mode: 'HTML',
            },
          );

          this.page = 0;
          const filter = ctx?.session?.meta_spy?.filter || 'all';
          const toggle_filter = filter === 'all' ? 'matched' : 'all';

          ctx.session = {
            meta_spy: {
              filter: toggle_filter,
            },
          };

          const metas = await this.getMetas({
            limit: DEFAULT_LIMIT,
            offset: this.page * DEFAULT_LIMIT,
            filter: toggle_filter,
          });
          await ctx.editMessageText(DEFAULT_META_HEADER + `${metas}`, {
            parse_mode: 'HTML',
          });
        },
      )
      .text('🔁 Refresh', async (ctx: any) => {
        await ctx.editMessageText(
          `${'scene.meta.text.title'}\n\n ⏳ Loading...`,
          {
            parse_mode: 'HTML',
          },
        );

        const filter = ctx?.session?.meta_spy?.filter || 'all';

        const metas = await this.getMetas({
          limit: DEFAULT_LIMIT,
          offset: this.page * DEFAULT_LIMIT,
          filter,
        });

        await ctx.editMessageText(DEFAULT_META_HEADER + `${metas}`, {
          parse_mode: 'HTML',
        });
      })
      .row()
      .text(t('general.buttons.back'), async (ctx: any) => {
        await ctx?.scene?.exit();
        await ctx.scenes.enter(PORTFOLIO_SCENE);
      });

    this.bot.use(trendingMetasMenu);
    this.bot.use(this.menu);
  }

  @SceneEnter()
  async onSceneEnter(ctx) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: NINJA_MODE_NEWS_SCENE,
      userId: ctx.from.id,
    });

    const filter = ctx?.session?.meta_spy?.filter || 'all';

    try {
      const metas = await this.getMetas({
        limit: DEFAULT_LIMIT,
        offset: this.page * DEFAULT_LIMIT,
        filter,
      });

      await ctx.replyWithHTML(DEFAULT_META_HEADER + `${metas}`, {
        reply_markup: this.menu,
      });
    } catch (error) {
      console.error(error);
    }

    return;
  }

  getinlineKeyboard(ctx) {
    const filter = ctx?.session?.meta_spy?.filter || 'all';

    return new InlineKeyboard()
      .row(
        InlineKeyboard.text('🔄 Load More', CALLBACK_QUERY.LOAD_MORE),
        InlineKeyboard.text('🔥 Trending Metas', CALLBACK_QUERY.TRENDING_METAS),
      )
      .row(
        InlineKeyboard.text(
          `Filter: ${filter === 'all' ? '🚀 All' : '🚨 Matches Only'}`,
          CALLBACK_QUERY.FILTER,
        ),
        InlineKeyboard.text('🔁 Refresh', CALLBACK_QUERY.REFRESH),
      )
      .row(
        InlineKeyboard.text(
          t('general.buttons.back'),
          CALLBACK_QUERY.BACK_TO_DOJO,
        ),
      );
  }

  async getMetas(input?: GetMetasParams) {
    const metas =
      await this.tradeNotificationsAnalysisService.getLatestMetasTopRated(
        input,
      );

    const parsedMetas = await Promise.all(
      metas.map(async (meta) => {
        const [detail] = await this.dexScreenerService.lookupToken(
          meta.tokenAddress,
        );

        const chart = `📈 5m: ${detail.change5m.formatted} | 1h: ${detail.change1h.formatted} | 6h: ${detail.change6h.formatted}`;

        return {
          ...meta,
          chart,
        };
      }),
    );
    /**
💬 Cats meta is trending hard. 'Cat' has potential moonshot.
📈 5m: +134.33% | 1h: +134.33% | 6h: +134.33%
🔥️ 78%  🕑 A few seconds ago
🚀 Purr-fect storm brewing. GET ON THIS MEOW TRAIN!
 */
    if (!metas || metas.length === 0) return '';

    return parsedMetas
      .map((meta: any) => {
        const ago = dayjs(meta.createdAt?.toDate()).fromNow();
        const chart_line = meta?.chart;
        return (
          `<b>${meta?.data?.symbol} | ${meta?.data?.name}</b>\n` +
          `/${meta.tokenAddress}\n` +
          `${meta.message}\n` +
          `${chart_line}\n` +
          `🔥️ ${meta.rating}% 🕑 ${ago} \n` +
          `🚀 ${meta.reasoning.replace(/[<>]/g, '')}\n`
        );
      })
      .join('\n');
  }
}
