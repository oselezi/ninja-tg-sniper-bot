import { Command, CallbackQuery, Update } from '@grammyjs/nestjs';
import { PORTFOLIO_SCENE, TAX_SCENE } from '../constants';
import { Markup } from 'telegraf';

import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { t } from '../../util';

@Update()
@Scene(TAX_SCENE)
export class TaxScene {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: TAX_SCENE,
      userId: ctx.from.id,
    });

    ctx.replyWithHTML(
      `Ninja tax functionality is currently being worked on at the Shinobi Shrine, please check back here for updates.`,
      Markup.inlineKeyboard([
        Markup.button.callback(t('general.buttons.back'), 'exit'),
      ]),
    );
    await ctx.scene.exit();
  }

  @Command(['exit', 'home', 'dojo'])
  @CallbackQuery(['exit', 'home', 'dojo'])
  async onLeaveCommand(ctx): Promise<any> {
    await ctx.scene.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  }
}
