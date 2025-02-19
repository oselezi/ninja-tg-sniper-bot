import { TOPUP_SCENE, PORTFOLIO_SCENE } from '../constants';
import { Context } from '../../interfaces/context.interface';

import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { AccountService } from '../../account/account.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';

import { InjectBot, Update } from '@grammyjs/nestjs';
import { Bot, Context as BotContext, InlineKeyboard } from 'grammy';
import {
  Scene,
  SceneEnter,
  SceneStep,
} from './library/decorators/scene.decorator';
import { Scene as GrammyScene } from 'grammy-scenes';
import { handleBaseCommands } from '../common/commands';
import { randomUUID } from 'crypto';
import { t } from '../../util';

enum CALLBACK_QUERY {
  DOJO = 'dojo',
}

@Update()
@Scene(TOPUP_SCENE)
export class TopupScene {
  private isEVM: boolean;
  private scene: GrammyScene;

  constructor(
    @InjectBot()
    private readonly bot: Bot<BotContext>,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.isEVM = process.env.EVM_ENABLED === 'true';
  }

  @SceneEnter()
  async onSceneEnter(ctx: Context) {
    // @ts-ignore
    const from = ctx.from || ctx.callback_query.from;
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: TOPUP_SCENE,
      userId: from.id,
    });

    const account = await this.accountService.get(`${from.id}`);
    const walletAddress = [account.walletPubKey];
    const userId = from.id;
    const timestamp = Date.now();
    const gatefiURL = `${process.env.GATEFI_URL}?merchantId=${process.env.GATEFI_MERCHANTID}&cryptoCurrency=SOL_SOL&cryptoCurrencyLock=true&wallet=${walletAddress}&walletLock=true&externalId=${userId}_${timestamp}`;
    console.log('gatefiURL', gatefiURL);
    const keyboard = new InlineKeyboard()
      .row(InlineKeyboard.webApp('Topup wallet', gatefiURL))
      .row(InlineKeyboard.text(t('general.buttons.back'), 'dojo'));
    await ctx.reply('Add Solana to your Wallet:', {
      reply_markup: keyboard,
    });
  }

  @SceneStep('callback')
  async onCallback() {
    this.scene.wait(randomUUID()).setup((scene) => {
      scene.on('message', async (ctx) => {
        const hasCommandHandled = await handleBaseCommands(ctx);
        if (hasCommandHandled) return;
      });

      scene.on('callback_query', async (ctx) => {
        const command = ctx.callbackQuery.data;

        switch (command) {
          case CALLBACK_QUERY.DOJO:
            await ctx.scene.exit();
            await ctx.scene.enter(PORTFOLIO_SCENE);
            break;
        }
      });
    });
  }
}
