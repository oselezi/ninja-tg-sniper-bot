import { InjectBot, Update } from '@grammyjs/nestjs';
import { PORTFOLIO_SCENE, SETTINGS_SCENE } from '../constants';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';
import { AccountService } from '@/account/account.service';
import {
  DEFAULT_SETTINGS,
  TRANSACTION_PRIORITY_AMOUNT,
} from '@/account/types/settings.types';
import { capitalize, formatCurrency, t } from '../../util';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Bot, Context } from 'grammy';
import { Scene as GrammyScene } from 'grammy-scenes';
import { Menu } from '@grammyjs/menu';
// import {
//   Conversation,
//   ConversationFlavor,
//   conversations,
//   createConversation,
// } from '@grammyjs/conversations';

enum CALLBACK_QUERY {
  CANCEL = 'cancel',
  EXIT = 'exit',
  ANNOUNCEMENTS_ENABLED = 'announcements_enabled',
  MIN_POS_VALUE = 'min_pos_value',
  AUTO_BUY_ENABLED = 'auto_buy_enabled',
  AUTO_BUY_AMOUNT = 'auto_buy_amount',
  BUY_BUTTON_LEFT = 'buy_button_left',
  BUY_BUTTON_RIGHT = 'buy_button_right',
  SELL_BUTTON_LEFT = 'sell_button_left',
  SELL_BUTTON_RIGHT = 'sell_button_right',
  SLIPPAGE_CONFIG_BUY = 'slippage_config_buy',
  SLIPPAGE_CONFIG_SELL = 'slippage_config_sell',
  MAX_PRICE_IMPACT = 'max_price_impact',
  MEV_PROTECT_TURBO = 'mev_protect_turbo',
  TRANSACTION_PRIORITY_LEVEL = 'transaction_priority_level',
  TRANSACTION_PRIORITY_AMOUNT = 'transaction_priority_amount',
  SWAP_PROVIDER_TOGGLE = 'swap_provider_toggle',
}

const emoji = {
  true: '🟢',
  false: '🔴',
};

// type MyContext = Context & ConversationFlavor;
// type MyConversation = Conversation<MyContext>;

@Update()
@Scene(SETTINGS_SCENE)
export class SettingsScene {
  private scene: GrammyScene;
  private menu: Menu;

  constructor(
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
    @InjectBot() private readonly bot: Bot<Context>,
  ) {
    // this.bot.use(
    //   createConversation(this.conversationHandler, {
    //     id: 'settings',
    //     maxMillisecondsToWait: 60000,
    //   }),
    // );

    this.menu = new Menu('settings_menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('-- GENERAL SETTINGS --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `${emoji[String(settings.announcements_enabled)]} Announcements`;
        },
        async (ctx) => {
          this.onAnnouncements(ctx);
          ctx.menu.update();
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Min Pos Value: ${formatCurrency(settings.min_pos_value, {
            minimumFractionDigits: 4,
          })}`;
        },
        async (ctx: any) => {
          // await ctx.conversation.enter('settings');

          await this.onMinPosValue(ctx, CALLBACK_QUERY.MIN_POS_VALUE);
        },
      )
      .row()
      .text('-- SOL PER SNIPE --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `${emoji[String(settings.auto_buy_enabled)]} Enabled`;
        },
        (ctx) => {
          this.onAutoBuyEnabled(ctx);
          ctx.menu.update();
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ ${settings.auto_buy_amount} SOL`;
        },
        async (ctx) => {
          await this.onAutoBuyAmount(ctx, CALLBACK_QUERY.AUTO_BUY_AMOUNT);
        },
      )
      .row()
      .text('-- BUY BUTTON --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Left: ${settings.buy_button_left} SOL`;
        },
        async (ctx) => {
          await this.onBuyButton(ctx, CALLBACK_QUERY.BUY_BUTTON_LEFT);
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Right: ${settings.buy_button_right} SOL`;
        },
        async (ctx) => {
          await this.onBuyButton(ctx, CALLBACK_QUERY.BUY_BUTTON_RIGHT);
        },
      )
      .row()
      .text('-- SELL BUTTON --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Left: ${settings.sell_button_left}%`;
        },
        async (ctx) => {
          await this.onSellButton(ctx, CALLBACK_QUERY.SELL_BUTTON_LEFT);
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Right: ${settings.sell_button_right}%`;
        },
        async (ctx) => {
          await this.onSellButton(ctx, CALLBACK_QUERY.SELL_BUTTON_RIGHT);
        },
      )
      .row()
      .text('-- SLIPPAGE CONFIG --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Buy: ${settings.slippage_config_buy}%`;
        },
        async (ctx) => {
          await this.onSlippageButton(ctx, CALLBACK_QUERY.SLIPPAGE_CONFIG_BUY);
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Sell: ${settings.slippage_config_sell}%`;
        },
        async (ctx) => {
          await this.onSlippageButton(ctx, CALLBACK_QUERY.SLIPPAGE_CONFIG_SELL);
        },
      )
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ Max Price Impact: ${settings.max_price_impact}%`;
        },
        async (ctx) => {
          await this.onMaxPriceImpact(ctx, CALLBACK_QUERY.MAX_PRICE_IMPACT);
        },
      )
      .row()
      .text('-- MEV PROTECT --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `⇌ ${capitalize(settings.mev_protect)}`;
        },
        (ctx) => {
          this.onMevProtectTurbo(ctx);
          ctx.menu.update();
        },
      )
      .row()
      .text('-- TRANSACTION PRIORITY --')
      .row()
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `⇌ ${capitalize(settings.transaction_priority)}`;
        },
        (ctx) => {
          this.onTransactionPriorityLevel(ctx);
          ctx.menu.update();
        },
      )
      .text(
        (ctx: any) => {
          const settings = ctx.session?.settings || DEFAULT_SETTINGS;
          return `✎ ${settings.transaction_priority_amount} SOL`;
        },
        async (ctx) => {
          await this.onTransactionPriorityAmount(
            ctx,
            CALLBACK_QUERY.TRANSACTION_PRIORITY_AMOUNT,
          );
        },
      )
      // .row()
      // .text(
      //   (ctx: any) => {
      //     const settings = ctx.session?.settings || DEFAULT_SETTINGS;
      //     return `-- Swap Provider - ${this.getProviderText(settings?.swap_provider)} -- `;
      //   },
      //   (ctx) => {
      //     this.onSwapProviderToggle(ctx);
      //     ctx.menu.update();
      //   },
      // )
      .row()
      .text(t('general.buttons.back'), this.onLeaveCommand);

    this.bot.use(this.menu);
  }

  @SceneEnter()
  async onSceneEnter(ctx: any) {
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: SETTINGS_SCENE,
      userId: ctx.from.id,
    });

    await ctx.replyWithHTML(
      `<strong>${t('scene.settings.text.title')}</strong>\n\n` +
        `${t('scene.settings.text.content')}`,
      {
        reply_markup: this.menu,
      },
    );
  }

  // async conversationHandler(conversation: MyConversation, ctx: MyContext) {
  //   // console.log('conversationHandler', conversation, ctx);

  //   await ctx.reply('Hi there! What is your name?');
  //   const { message } = await conversation.wait();
  //   await ctx.reply(`Welcome to the chat, ${message.text}!`);
  // }

  getProviderText(provider: string) {
    return provider == 'jupiter' ? '☄️ Jupiter' : '🥷 Sumo';
  }

  async onSwapProviderToggle(ctx) {
    const swapProvider =
      ctx.session?.settings?.swap_provider == 'jupiter' ? 'sumo' : 'jupiter';

    ctx.session.settings = {
      ...(ctx.session.settings || DEFAULT_SETTINGS),
      swap_provider: swapProvider,
    };

    await this.saveUserSettings(ctx);
  }

  updateContextSession(ctx, command = '') {
    ctx.session.current_scene = SETTINGS_SCENE;

    ctx.session.settings = {
      ...(ctx.session.settings || DEFAULT_SETTINGS),
      current_command: command,
    };
  }

  async saveUserSettings(ctx) {
    const from = ctx.from || ctx.callback_query.from;

    await this.accountService.update(from.id.toString(), {
      settings: ctx.session.settings,
    });

    // await ctx.deleteMessage();
    // await ctx.scene.goto('onEnter');
  }

  async onAnnouncements(ctx) {
    ctx.session.settings = {
      ...(ctx.session.settings || DEFAULT_SETTINGS),
      announcements_enabled: !ctx.session.settings?.announcements_enabled,
    };

    this.saveUserSettings(ctx);
  }

  async onMinPosValue(ctx, command = '') {
    this.updateContextSession(ctx, command);

    await ctx.reply('Enter the minimum position value to show in portfolio', {
      reply_markup: {
        force_reply: true,
      },
    });
  }

  async onAutoBuyEnabled(ctx) {
    ctx.session.settings = {
      ...(ctx.session.settings || DEFAULT_SETTINGS),
      auto_buy_enabled: !ctx.session.settings?.auto_buy_enabled,
    };

    await this.saveUserSettings(ctx);
  }

  async onAutoBuyAmount(ctx, command = '') {
    this.updateContextSession(ctx, command);

    await ctx.reply('Enter the amount to auto buy', {
      reply_markup: {
        force_reply: true,
      },
    });
  }

  async onBuyButton(ctx, command = '') {
    this.updateContextSession(ctx, command);

    const isLeft = command === CALLBACK_QUERY.BUY_BUTTON_LEFT;

    await ctx.reply(
      `Enter the amount for the ${isLeft ? 'left' : 'right'} button`,
      {
        reply_markup: {
          force_reply: true,
        },
      },
    );
  }

  async onSellButton(ctx, command = '') {
    this.updateContextSession(ctx, command);

    const isLeft = command === CALLBACK_QUERY.SELL_BUTTON_LEFT;

    await ctx.reply(
      `Enter the percentage for the ${isLeft ? 'left' : 'right'} button`,
      {
        reply_markup: {
          force_reply: true,
        },
      },
    );
  }

  async onSlippageButton(ctx, command = '') {
    this.updateContextSession(ctx, command);

    await ctx.reply('Enter the slippage percentage', {
      reply_markup: {
        force_reply: true,
      },
    });
  }

  async onMaxPriceImpact(ctx, command = '') {
    this.updateContextSession(ctx, command);

    await ctx.reply('Enter the max price impact', {
      reply_markup: {
        force_reply: true,
      },
    });
  }

  async onMevProtectTurbo(ctx) {
    const mev_protect =
      ctx?.session.settings?.mev_protect || DEFAULT_SETTINGS.mev_protect;

    if (mev_protect === 'turbo') {
      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        mev_protect: 'secure',
      };
    } else {
      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        mev_protect: 'turbo',
      };
    }

    await this.saveUserSettings(ctx);
  }

  async onTransactionPriorityLevel(ctx) {
    const level =
      ctx?.session?.settings?.transaction_priority ||
      DEFAULT_SETTINGS.transaction_priority;

    if (level === 'low') {
      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        transaction_priority: 'medium',
        transaction_priority_amount: TRANSACTION_PRIORITY_AMOUNT['medium'],
      };
    } else if (level === 'medium') {
      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        transaction_priority: 'high',
        transaction_priority_amount: TRANSACTION_PRIORITY_AMOUNT['high'],
      };
    } else {
      ctx.session.settings = {
        ...(ctx.session.settings || DEFAULT_SETTINGS),
        transaction_priority: 'low',
        transaction_priority_amount: TRANSACTION_PRIORITY_AMOUNT['low'],
      };
    }

    await this.saveUserSettings(ctx);
  }

  async onTransactionPriorityAmount(ctx, command = '') {
    this.updateContextSession(ctx, command);

    await ctx.reply('Enter the transaction priority amount', {
      reply_markup: {
        force_reply: true,
      },
    });
  }

  async onLeaveCommand(ctx) {
    await ctx?.scene?.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  }
}
