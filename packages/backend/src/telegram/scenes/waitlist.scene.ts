import { Command, CallbackQuery } from '@grammyjs/nestjs';
import { WAITLIST_SCENE, CHAT_SCENE } from '../constants';

import { AccountService } from '../../account/account.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { BigNumber } from 'bignumber.js';
import { resolve } from '../../util';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { mainLongMenuKeyboard } from '../common/keyboards';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { getGatefiURL } from '../helpers/helpers';

@Scene(WAITLIST_SCENE)
export class WaitListScene {
  constructor(
    private readonly accountService: AccountService,
    private readonly blockchainService: BlockchainService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: WAITLIST_SCENE,
      userId: ctx.from.id,
    });

    const account = await this.accountService.createOrGetAccount(
      `${ctx.from.id}`,
      ctx.from.username,
      { groupId: `${ctx.chat.id}` },
    );

    let assetAmount = new BigNumber(0);
    const [error, asset] = await resolve(
      this.blockchainService.getTokenAccountBalance(
        '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
        account.walletPubKey,
      ),
    );

    if (!error) {
      assetAmount = BigNumber(asset.token.amount.toString());
      ctx.session.ninjaBalance = +assetAmount;
    }

    await ctx.replyWithVideo(
      'https://firebasestorage.googleapis.com/v0/b/solarsol2024.appspot.com/o/ninja-welcome.mp4?alt=media&token=07f279e0-f5f6-42d7-ac51-e4087ea1a737',
      {
        parse_mode: 'HTML',
        reply_markup: mainLongMenuKeyboard({
          gatefiURL: getGatefiURL({ account }),
        }),
        caption:
          `<strong>Welcome to training Ninja 🥷</strong>` +
          `\n\nSo many Ninja’s are joining the clan that we will need keep some in the training camp whilst we increase our capacity. We will be letting more Ninja’s through each day and picking the most devoted. ` +
          `\n\nTo move up the waitlist, deposit some Ninja to your wallet, and you’ll move up the ranks. Recruit more Ninja’s to move up or train 50 Ninja's to get instant access via /refer.` +
          `\n\nWallet <code>${account.walletPubKey}</code> (tap to copy)` +
          `\n\nGood luck. 🫡` +
          `\n\nIn the meantime checkout our channels, /chat & /refer` +
          `\n\nCurrent Ninja Balance: ${assetAmount.dividedBy(LAMPORTS_PER_SOL).toFormat() || 0} $NINJA` +
          `\n\nWait list Position: RANK ${account.waitlistPosition || 0}`,
      },
    );

    if (assetAmount.gte(0) && account?.enabledAccount === false) {
      await this.accountService.update(`${ctx.from.id}`, {
        waitlistPosition: 0,
        enabledAccount: true,
        enabledAccountAt: new Date(),
      });
    }

    await ctx.scene.exit();
  }

  @Command(['chat'])
  @CallbackQuery(['chat'])
  async manageChat(ctx) {
    ctx.scenes.enter(CHAT_SCENE);
  }
}
