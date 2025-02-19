import { Command, CallbackQuery } from '@grammyjs/nestjs';
import { PORTFOLIO_SCENE, REFER_SCENE } from '../constants';
import { AccountService } from '../../account/account.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { backToDojoKeyboardMenu } from '../common/keyboards';
import { t } from '../../util';

@Scene(REFER_SCENE)
export class ReferScene {
  constructor(
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
  ) {}
  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: REFER_SCENE,
      userId: ctx.from.id,
    });

    const percentageFirstMonth =
      process.env.REFERRAL_PERCENTAGE_FIRST_MONTH || '0';
    const percentageSecondMonth =
      process.env.REFERRAL_PERCENTAGE_SECOND_MONTH || '0';
    const percentageForever = process.env.REFERRAL_PERCENTAGE_FOREVER || '0';

    const referralId = await this.accountService.getOrCreateReferralLink(
      `${ctx.from.id}`,
    );

    const referralCount =
      await this.accountService.getReferralCount(referralId);

    // allow instant access if 50 referrals
    // check that the user has not already been enabled
    if (referralCount > 0 && !ctx.session?.account?.enabled) {
      await this.accountService.update(`${ctx.from.id}`, {
        enabledAccount: true,
        enabledAccountAt: new Date(),
        referralCount,
      });

      ctx.session.enabledAccount = true;
    }

    const replacements = {
      '##FIRST_MONTH##': `${percentageFirstMonth}%`,
      '##SECOND_MONTH##': `${percentageSecondMonth}%`,
      '##FOREVER##': `${percentageForever}%`,
    };

    await ctx.replyWithHTML(
      `${t('scene.refer.text.title')}` +
        `\n\n<strong>Your referral link:</strong> ${process.env.REFERRAL_URL || ''}?start=ref_${referralId}` +
        `\n<strong>Referrals:</strong> ${referralCount}` +
        `\n\n${t('scene.refer.text.content').replace(/##FIRST_MONTH##|##SECOND_MONTH##|##FOREVER##/g, (matched) => replacements[matched])}`,
      {
        reply_markup: backToDojoKeyboardMenu,
      },
    );
  }

  @Command(['exit', 'home', 'cancel', 'dojo'])
  @CallbackQuery(['exit', 'home', 'cancel', 'dojo'])
  async onLeaveCommand(ctx): Promise<any> {
    await ctx.scene.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  }
}
