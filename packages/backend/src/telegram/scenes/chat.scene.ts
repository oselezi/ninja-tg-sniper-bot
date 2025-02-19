import { Update } from '@grammyjs/nestjs';
import { CHAT_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '@/analytics/analytics.types';

import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { backToDojoKeyboardMenu } from '../common/keyboards';

@Update()
@Scene(CHAT_SCENE)
export class ChatScene {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: CHAT_SCENE,
      userId: ctx.from.id,
    });

    const enabled = ctx.session.account ? ctx.session.account.enabled : true;

    ctx.replyWithHTML(
      `Main: https://t.me/shinobininjatoken\n\n` +
        `Scanner: https://t.me/+eQT37KHNJiY2MDlk\n\n` +
        `Art Dojo: https://t.me/+5FYxGUcxheQxYTY5\n\n` +
        `Chinese Dojo: https://t.me/shinobininjachinese\n\n` +
        `Raid Dojo: https://t.me/+__MgcQrvl9gyMDA8\n\n` +
        `Support: https://t.me/NinjaSupportDojo\n\n`,
      {
        reply_markup: enabled ? backToDojoKeyboardMenu : null,
        link_preview_options: {
          is_disabled: true,
        },
      },
    );
  }
}
