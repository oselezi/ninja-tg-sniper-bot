import { Command, CallbackQuery } from '@grammyjs/nestjs';
import { PORTFOLIO_SCENE, SENSEI_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { backToDojoKeyboardMenu } from '../common/keyboards';
import { t } from '../../util';

@Scene(SENSEI_SCENE)
export class SenseiScene {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: SENSEI_SCENE,
      userId: ctx.from.id,
    });

    const enabled = ctx.session.account ? ctx.session.account.enabled : true;

    ctx.replyWithHTML(t('scene.help.text.content'), {
      reply_markup: enabled ? backToDojoKeyboardMenu : null,
    });
    // await ctx.scene.exit();
  }

  @Command(['exit', 'home', 'cancel', 'dojo'])
  @CallbackQuery(['exit', 'home', 'cancel', 'dojo'])
  async onLeaveCommand(ctx): Promise<any> {
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  }
}
