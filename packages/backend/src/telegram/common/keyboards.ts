import { Menu } from '@grammyjs/menu';
import { PORTFOLIO_SCENE } from '../constants';
import { InlineKeyboard } from 'grammy';
import { t } from '../../util';

export const INLINE_KEYBOARD_COMMANDS = {
  BUY: 'buy',
  SELL: 'sell',
  META_SPY: 'ninja_mode_news',
  HELP: 'sensei',
  NINJA_SNIPER: 'ninja_mode',
  BUY_NINJA: 'ninja_single',
  WALLET: 'wallet',
  SETTINGS: 'settings',
  REFRESH: 'refresh',
  KAMIKAZE: 'kamikaze',
  REFER: 'refer',
  ACTIVITY: 'activity',
};

type Params = {
  gatefiURL: string;
  ninaModeActive?: boolean;
};

export const mainShortMenuKeyboard = ({ gatefiURL }: Params) =>
  new InlineKeyboard()
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.buy'),
        INLINE_KEYBOARD_COMMANDS.BUY,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.sell'),
        INLINE_KEYBOARD_COMMANDS.SELL,
      ),
      InlineKeyboard.url(t('scene.portfolio.buttons.topup'), gatefiURL),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.meta'),
        INLINE_KEYBOARD_COMMANDS.META_SPY,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.help'),
        INLINE_KEYBOARD_COMMANDS.HELP,
      ),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.sniper'),
        INLINE_KEYBOARD_COMMANDS.NINJA_SNIPER,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.single'),
        INLINE_KEYBOARD_COMMANDS.BUY_NINJA,
      ),
    );

export const mainLongMenuKeyboard = ({ gatefiURL, ninaModeActive }: Params) =>
  new InlineKeyboard()
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.buy'),
        INLINE_KEYBOARD_COMMANDS.BUY,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.sell'),
        INLINE_KEYBOARD_COMMANDS.SELL,
      ),
      InlineKeyboard.url(t('scene.portfolio.buttons.topup'), gatefiURL),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.meta'),
        INLINE_KEYBOARD_COMMANDS.META_SPY,
      ),
      InlineKeyboard.text(
        `${ninaModeActive ? '✅' : ''}${t('scene.portfolio.buttons.sniper')}`,
        INLINE_KEYBOARD_COMMANDS.NINJA_SNIPER,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.refer'),
        INLINE_KEYBOARD_COMMANDS.REFER,
      ),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.wallet'),
        INLINE_KEYBOARD_COMMANDS.WALLET,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.activity'),
        INLINE_KEYBOARD_COMMANDS.ACTIVITY,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.settings'),
        INLINE_KEYBOARD_COMMANDS.SETTINGS,
      ),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.kamikaze'),
        INLINE_KEYBOARD_COMMANDS.KAMIKAZE,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.single'),
        INLINE_KEYBOARD_COMMANDS.BUY_NINJA,
      ),
      InlineKeyboard.text(
        t('scene.portfolio.buttons.help'),
        INLINE_KEYBOARD_COMMANDS.HELP,
      ),
    )
    .row(
      InlineKeyboard.text(
        t('scene.portfolio.buttons.refresh'),
        INLINE_KEYBOARD_COMMANDS.REFRESH,
      ),
    );

export const backToDojoKeyboardMenu = new Menu('back-to-dojo-keyboard').text(
  t('general.buttons.back'),
  async (ctx: any) => {
    await ctx?.scene?.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  },
);

export const exitNinjaKeyboard = new Menu('exit-dojo-keyboard')
  .text('Continue ✅', async (ctx: any) => {
    ctx.session.current_scene = '';
    await ctx.deleteMessage();
  })
  .text('Stop Ninja Mode 🚫', async (ctx: any) => {
    await ctx.reply('Ninja mode cancelled.');

    ctx.session.current_scene = '';
    ctx.session.ninjaMode = {};

    await ctx?.scene?.exit();
    await ctx.scenes.enter(PORTFOLIO_SCENE);
  })
  .row()
  .text(t('general.buttons.back'), async (ctx: any) => {
    ctx.session.current_scene = '';
    await ctx.deleteMessage();
  });
