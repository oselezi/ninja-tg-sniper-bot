import { InjectBot, Update } from '@grammyjs/nestjs';
import { KAMIKAZE_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '@/analytics/analytics.types';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Bot, Context } from 'grammy';
import { Menu } from '@grammyjs/menu';
import { t } from '../../util';

@Update()
@Scene(KAMIKAZE_SCENE)
export class KamikazeScene {
  private menu: Menu;

  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectBot() private readonly bot: Bot<Context>,
  ) {
    const submenu = new Menu('kamikaze-submenu')
      .text('$NINJA amount', async (ctx: any) => {
        ctx.session.current_scene = KAMIKAZE_SCENE;
        ctx.session.kamikaze_type = 'amount';

        await ctx.reply('Enter the amount of $NINJA you want to burn', {
          reply_markup: {
            force_reply: true,
          },
        });
      })
      .text('$NINJA percentage', async (ctx: any) => {
        ctx.session.current_scene = KAMIKAZE_SCENE;
        ctx.session.kamikaze_type = 'percentage';

        await ctx.reply('Enter the percentage of $NINJA you want to burn', {
          reply_markup: {
            force_reply: true,
          },
        });
      })
      .row()
      .back('Cancel');

    this.menu = new Menu('kamikaze-menu')
      .submenu(t('scene.kamikaze.buttons.burn'), 'kamikaze-submenu')
      .row()
      .text(t('general.buttons.back'), async (ctx) => {
        await ctx.deleteMessage();
      });

    this.menu.register(submenu);
    this.bot.use(this.menu);
  }

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: KAMIKAZE_SCENE,
      userId: ctx.from.id,
    });

    ctx.replyWithHTML(
      `${t('scene.kamikaze.text.title')}\n\n` +
        t('scene.kamikaze.text.content'),
      {
        reply_markup: this.menu,
      },
    );
  }
}

/**

  {
    mint: {
      decimals: 9,
      isInitialized: true,
      freezeAuthority: [Object],
      header: [Object],
      mintAuthority: [Object],
      publicKey: '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
      supply: 999905394259584500
    },
    metadata: {
      editionNonce: [Object],
      symbol: 'NINJA',
      tokenStandard: [Object],
      creators: [Object],
      primarySaleHappened: true,
      sellerFeeBasisPoints: 0,
      publicKey: 'FweAq11GVGLtGqiHTAJVQvPzPtzH4951bTVgz7YigqPe',
      collection: [Object],
      uri: 'https://bafkreidtvt6exae5ayigyktanugcssgxnwa2oudxhugyktq73fpvwlmwgq.ipfs.nftstorage.link',
      programmableConfig: [Object],
      mint: '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
      collectionDetails: [Object],
      isMutable: true,
      updateAuthority: '131ztL19fZga7Kok7eia7padEDf6HZ6Q1cxJWToqoZWJ',
      name: 'Shinobi ',
      header: [Object],
      uses: [Object],
      key: 4
    },
    publicKey: '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
    token: {
      owner: 'J3t1arkybLLsDHrJnBi6ZNxr8sX1kwG4zeNHTWV9ivE5',
      delegate: [Object],
      mint: '2xP43MawHfU7pwPUmvkc6AUWg4GX8xPQLTGMkSZfCEJT',
      amount: 424079813183,
      delegatedAmount: 0,
      closeAuthority: [Object],
      header: [Object],
      publicKey: '56C3WZxa1DX6EruTx6b4wykpKwfcFjPV9BcyR3djyr4w',
      state: 1,
      isNative: [Object]
    }
  }

 */
