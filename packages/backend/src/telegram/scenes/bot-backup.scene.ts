import { Update } from '@grammyjs/nestjs';
import { BOT_BACKUP_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { backToDojoKeyboardMenu } from '../common/keyboards';

@Update()
@Scene(BOT_BACKUP_SCENE)
export class BotBackupScene {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: BOT_BACKUP_SCENE,
      userId: ctx.from.id,
    });

    ctx.replyWithHTML(
      `🤖 Backup Bots\n\n` +
        `Use these backup bots if our main bot is slow or down. You will have access to the same wallet, dojo and features.\n\n` +
        `<a href="https://t.me/ninja_shinobi_bot">@ninja_shinobi_bot</a>\n` +
        `<a href="https://t.me/kawaiininjabot">@kawaiininjabot</a>\n` +
        `<a href="https://t.me/narutosniperbot">@narutosniperbot</a>\n` +
        `<a href="https://t.me/hanzoninjabot">@hanzoninjabot</a>\n` +
        `<a href="https://t.me/chuninninjabot">@chuninninjabot</a>\n` +
        `<a href="https://t.me/joninninjabot">@joninninjabot</a>\n` +
        `<a href="https://t.me/hokageninjabot">@hokageninjabot</a>\n` +
        `<a href="https://t.me/geninninjabot">@geninninjabot</a>\n`,
      {
        reply_markup: backToDojoKeyboardMenu,
      },
    );
  }
}
