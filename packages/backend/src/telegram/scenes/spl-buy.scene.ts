import { Update } from '@grammyjs/nestjs';
import { Logger } from '@nestjs/common';
import { BUY_SPL_SCENE, SINGLE_SLP_SCENE } from '../constants';

import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';

import {
  Scene,
  SceneEnter,
  SceneStep,
} from './library/decorators/scene.decorator';
import { backToDojoKeyboardMenu } from '../common/keyboards';
import { Scene as GrammyScene } from 'grammy-scenes';
import { randomUUID } from 'crypto';
import { handleBaseCommands } from '../common/commands';
import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { t } from '../../util';

@Update()
@Scene(BUY_SPL_SCENE)
export class BuySLPScene {
  scene: GrammyScene;
  logger = new Logger(BuySLPScene.name);
  constructor(
    private readonly blockchainMainService: BlockchainMainService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @SceneEnter()
  async onSceneEnter(ctx) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: BUY_SPL_SCENE,
      userId: ctx.from.id,
    });

    await ctx.reply(t('scene.buy.text.content'), {
      reply_markup: backToDojoKeyboardMenu,
    });
  }

  @SceneStep('message')
  async onSingleToken(_ctx) {
    this.scene.wait(randomUUID()).setup((scene) => {
      scene.on('message', async (ctx) => {
        const hasCommandHandled = await handleBaseCommands(ctx);
        if (hasCommandHandled) return;

        const text = ctx.message?.text || ctx.update.message?.text;

        const token = await this.blockchainMainService.getTokenFromString(text);
        this.logger.debug('Token:', token, text);

        if (token) {
          await ctx?.scene?.exit();
          await ctx.scenes.enter(SINGLE_SLP_SCENE, { token });
        } else {
          await ctx.reply(
            `Token not found. Make sure address (${ctx.message?.text}) is correct. You can enter a token address or a Solscan/Birdeye link.`,
          );
        }
      });
    });
  }
}
