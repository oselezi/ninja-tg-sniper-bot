import { Context, InjectBot, Update } from '@grammyjs/nestjs';

import { Logger } from '@nestjs/common';
import { NINJA_MODE_SCENE, PORTFOLIO_SCENE } from '../constants';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { TradeNotificationsAnalysisService } from '../../trade-notifications-analysis/trade-notifications-analysis.service';
import { get } from 'lodash';
import { exitNinjaKeyboard } from '../common/keyboards';
import { AccountService } from '../../account/account.service';
import { Menu } from '@grammyjs/menu';
import { Bot } from 'grammy';
import { t } from '../../util';

const STAMINA_SAFU = 'duration_1hr';
const STAMINA_NORMIE = 'duration_5hr';
const STAMINA_DEGEN = 'duration_1day';
const STAMINA_NINJA_DEGEN = 'duration_3day';

@Update()
@Scene(NINJA_MODE_SCENE)
export class NinjaModeScene {
  logger = new Logger(NinjaModeScene.name);
  private menuBackToDojo: Menu;
  private menuDuration: Menu;
  private menuStart: Menu;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly tradeNotificationsAnalysisService: TradeNotificationsAnalysisService,
    private readonly accountService: AccountService,
    @InjectBot() private readonly bot: Bot,
  ) {
    this.menuBackToDojo = new Menu('ninja-mode-back-to-dojo').text(
      t('general.buttons.back'),
      async (ctx: any) => {
        ctx.session.current_scene = '';
        await ctx.deleteMessage();
      },
    );

    this.menuDuration = new Menu('ninja-mode-duration')
      .text(t('scene.sniper_duration.buttons.1h'), async (ctx) => {
        await this.onCompleteSetComplete(ctx, STAMINA_SAFU);
      })
      .text(t('scene.sniper_duration.buttons.5h'), async (ctx) => {
        await this.onCompleteSetComplete(ctx, STAMINA_NORMIE);
      })
      .row()
      .text(t('scene.sniper_duration.buttons.1d'), async (ctx) => {
        await this.onCompleteSetComplete(ctx, STAMINA_DEGEN);
      })
      .text(t('scene.sniper_duration.buttons.3d'), async (ctx) => {
        await this.onCompleteSetComplete(ctx, STAMINA_NINJA_DEGEN);
      });

    this.menuStart = new Menu('ninja-mode-start')
      .text('Start ✅', async (ctx) => {
        await this.startNinjaMode(ctx);
      })
      .text('Cancel 🚫', async (ctx: any) => {
        await ctx?.scene?.exit();
        await ctx.scenes.enter(PORTFOLIO_SCENE);
      });

    this.bot.use(this.menuStart);
    this.bot.use(this.menuDuration);
    this.bot.use(this.menuBackToDojo);
  }

  @SceneEnter()
  async stepOne(@Context() ctx) {
    ctx.session.current_scene = NINJA_MODE_SCENE;
    const isAction = this.getNinjaModeSession(ctx, 'active');
    if (isAction) {
      await ctx.reply(
        `${t('scene.sniper.text.title')} is already active. Be strong on your current quest.`,
        {
          reply_markup: exitNinjaKeyboard,
        },
      );
      return;
    }
    this.clearNinjaModeSession(ctx);

    const settings = await this.accountService.getAccountSettings(
      `${ctx.from.id}`,
    );
    const { parsedTrends, firstMeta, tags } =
      await this.tradeNotificationsAnalysisService.getLatestTrendParsed();

    const metaOptions = parsedTrends
      .map((trend) => {
        return `${trend}\n`;
      })
      .join('');

    this.setNinjaModeSession(ctx, { tags, parsedTrends });

    const sniping = settings.auto_buy_enabled
      ? `🔫 ${settings.auto_buy_amount} SOL per snipe (Manage in /settings)`
      : '🔴 0 SOL per snipe (Manage in /settings)';

    await ctx.replyWithHTML(
      `${t('scene.sniper.text.title')}: 🚫 Disabled\n\n` +
        sniping +
        '\n\n' +
        `${t('scene.sniper.text.content')} ${firstMeta}):\n\n` +
        `${metaOptions}` +
        `---\n\n ` +
        `<i>${t('scene.sniper.text.footer')}</i>`,
      {
        reply_markup: this.menuBackToDojo,
      },
    );

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: NINJA_MODE_SCENE,
      userId: ctx.from.id,
      page: 'Ninja Mode',
    });
  }

  // // helper for setting session
  setNinjaModeSession(ctx, data = {}) {
    const ninjaMode = ctx.session?.ninjaMode || {};

    ctx.session.ninjaMode = {
      ...ninjaMode,
      ...data,
    };

    return ctx.session.ninjaMode;
  }

  clearNinjaModeSession(ctx) {
    ctx.session.ninjaMode = {};
  }

  getNinjaModeSession(ctx, property = '', defaultValue: any = '') {
    const _p = property ? `ninjaMode.${property}` : 'ninjaMode';
    return get(ctx.session, _p, defaultValue);
  }

  async setMetaTags(@Context() ctx) {
    const text = ctx.message?.text || ctx.update?.message?.text;

    const metaIndexes = text?.split(',') || [];
    // TODO: Number validation

    // convert index to tags
    const sessionTags = this.getNinjaModeSession(ctx, 'tags', []);
    const parsedTrends = this.getNinjaModeSession(ctx, 'parsedTrends', []);

    const selectedTrends = [];
    const selectedTags = metaIndexes.map((index) => {
      const cleanIndex = index.replace(/[^\d]/g, '');
      const number = +cleanIndex - 1;
      selectedTrends.push(parsedTrends[number]);
      return sessionTags[number];
    });

    await this.setNinjaModeSession(ctx, { selectedTrends });
    await this.setNinjaModeSession(ctx, { metas: selectedTags });

    if (selectedTags.length === 0) {
      await ctx.reply(
        `You have not selected any metas. Please enter the metas you would like to snipe. e.g. 1, 5, 7. \n\n`,
        {
          reply_markup: this.menuBackToDojo,
        },
      );
      return;
    }

    await ctx.reply(t('scene.sniper_duration.text.content'), {
      reply_markup: this.menuDuration,
    });

    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: NINJA_MODE_SCENE,
      userId: ctx.from.id,
      page: 'Selected Metas',
      tags: selectedTags,
    });
  }

  async onCompleteSetComplete(ctx, _duration: string): Promise<any> {
    const duration = _duration.split('_')[1];
    const { uiDuration, campaignEndDatetime } = parseDuration(duration);

    const { selectedTrends } = this.getNinjaModeSession(ctx);

    const settings = await this.accountService.getAccountSettings(
      `${ctx.from.id}`,
    );

    let autoBuy = '';
    if (settings?.auto_buy_enabled) {
      //  '🟢' : '🔴'
      autoBuy = `\n🟢 Auto buy is enabled, buying ${settings.auto_buy_amount} SOL`;
    }

    this.setNinjaModeSession(ctx, {
      endAt: campaignEndDatetime,
      autoBuy: settings.auto_buy_enabled,
      autoBuyAmount: settings.auto_buy_amount,
    });

    await ctx.reply(
      `🔮 Lets recap.\n` +
        `\nTracking these metas: \n\n${selectedTrends.join('\n')}` +
        `\n⏲️ Active for: ${uiDuration}` +
        autoBuy +
        `\n\n`,
      {
        reply_markup: this.menuStart,
      },
    );
  }

  async startNinjaMode(ctx) {
    const botId = ctx.me.id;

    this.setNinjaModeSession(ctx, { chatId: ctx.chat.id, active: true, botId });

    await ctx.scene?.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: NINJA_MODE_SCENE,
      userId: ctx.from.id,
      page: 'Start',
    });
  }
}

const parseDuration = (duration: string) => {
  let campaignEndDatetime: Date;
  let uiDuration: string;
  const now = new Date();

  switch (duration) {
    case '1hr':
      uiDuration = '1 hour';
      campaignEndDatetime = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      break;
    case '5hr':
      uiDuration = '5 hours';
      campaignEndDatetime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      break;
    case '1day':
      uiDuration = '1 day';
      campaignEndDatetime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case '3day':
      uiDuration = '3 days';
      campaignEndDatetime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error('Invalid duration');
  }
  return { uiDuration, campaignEndDatetime };
};
