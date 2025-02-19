import {
  WALLET_SCENE,
  SOL_TRANSFER_SCENE,
  PORTFOLIO_SCENE,
} from '../constants';
import { Context } from '../../interfaces/context.interface';

import { BlockchainMainService } from '../../blockchain-main/blockchain-main.service';
import { AccountService } from '../../account/account.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ANALYTICS_SCENE_VIEW } from '../../analytics/analytics.types';

import { InjectBot, Update } from '@grammyjs/nestjs';
import { Bot, Context as BotContext } from 'grammy';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { Menu } from '@grammyjs/menu';
import { t } from '../../util';

@Update()
@Scene(WALLET_SCENE)
export class WalletScene {
  private isEVM: boolean;
  private menu: Menu;

  constructor(
    @InjectBot()
    private readonly bot: Bot<BotContext>,
    private readonly blockchainMainService: BlockchainMainService,
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.isEVM = process.env.EVM_ENABLED === 'true';
    const closeMenu = new Menu('wallet-close', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    }).text('Delete', async (ctx) => {
      await ctx.deleteMessage();
    });

    const baseExportPk = new Menu('base-export-pk', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .back('Cancel', async (ctx) => {
        const message = await this.evmMessage(ctx);
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
        });
      })
      .submenu('Confirm', 'wallet-close', async (ctx) => {
        const from =
          ctx?.from ||
          ctx?.callbackQuery?.from ||
          ctx?.update?.callback_query?.from;

        const account = await this.accountService.get(`${from.id}`);
        const walletKey = account.xWalletPrivateKey;

        await ctx.editMessageText(
          `Your <b>Private Key</b> is:\n\n` +
            `<code>${walletKey}</code>\n\n` +
            `You can now i.e. import the key into a wallet like MetaMask, Coinbase. (tap to copy).\n` +
            `Delete this message once you are done.`,
          {
            parse_mode: 'HTML',
          },
        );
      });

    const baseWallet = new Menu('base-wallet-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('🛍️ Withdraw all BASE', async (ctx: any) => {
        await ctx.scenes.enter(SOL_TRANSFER_SCENE, {
          selectedWallet: 'evm',
        });
      })
      .text('Withdraw X ETH', async (ctx: any) => {
        await ctx.scenes.enter(SOL_TRANSFER_SCENE, {
          selectedWallet: 'evm',
        });
      })
      .row()
      .submenu('🗝️ Export Private Key', 'base-export-pk', async (ctx: any) => {
        await ctx.editMessageText(
          `Are you sure you want to export your <b>Private Key</b>?`,
          {
            parse_mode: 'HTML',
          },
        );
      })
      .back('⏪ Back', async (ctx) => {
        const message = await this.mainMessage(ctx);
        await ctx.editMessageText(message, { parse_mode: 'HTML' });
      });
    baseWallet.register(baseExportPk);

    const solanaExportPK = new Menu('solana-export-pk', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .back('Cancel', async (ctx) => {
        const message = await this.solanaMessage(ctx);

        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
        });
      })
      .submenu('Confirm', 'wallet-close', async (ctx) => {
        const from =
          ctx?.from ||
          ctx?.callbackQuery?.from ||
          ctx?.update?.callback_query?.from;

        const account = await this.accountService.get(`${from.id}`);
        const walletKey = account.walletPrivateKey;

        await ctx.editMessageText(
          `Your <b>Private Key</b> is:\n\n` +
            `<code>${walletKey}</code>\n\n` +
            `You can now i.e. import the key into a wallet like Solflare, Phanton. (tap to copy).\n` +
            `Delete this message once you are done.`,
          {
            parse_mode: 'HTML',
          },
        );
      });

    solanaExportPK.register(closeMenu);
    const solanaWallet = new Menu('solana-wallet-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    })
      .text('🛍️ Withdraw all SOL', async (ctx: any) => {
        await ctx.scenes.enter(SOL_TRANSFER_SCENE, {
          selectedWallet: 'sol',
        });
      })
      .text('Withdraw X SOL', async (ctx: any) => {
        await ctx.scenes.enter(SOL_TRANSFER_SCENE, {
          selectedWallet: 'sol',
        });
      })
      .row()
      .submenu('🗝️ Export Private Key', 'solana-export-pk', async (ctx) => {
        await ctx.editMessageText(
          `Are you sure you want to export your <b>Private Key</b>?`,
          {
            parse_mode: 'HTML',
          },
        );
      })
      .back('⏪ Back', async (ctx) => {
        const message = await this.mainMessage(ctx);
        await ctx.editMessageText(message, { parse_mode: 'HTML' });
      });

    solanaWallet.register(solanaExportPK);
    this.menu = new Menu('wallet-menu', {
      onMenuOutdated: (ctx) => {
        ctx.menu.update();
      },
    }).dynamic(async (ctx, range) => {
      const from =
        ctx?.from ||
        ctx?.callbackQuery?.from ||
        ctx?.update?.callback_query?.from;

      const account = await this.accountService.get(`${from.id}`);
      range
        .url(
          '🪟 View on Solscan',
          `https://solscan.io/address/${account.walletPubKey}`,
        )
        .text(t('general.buttons.back'), async (ctx: any) => {
          await ctx?.scene?.exit();
          await ctx.scenes.enter(PORTFOLIO_SCENE);
        })
        .row()
        .submenu(
          'Manage SOL Wallet',
          'solana-wallet-menu',
          async (ctx: any) => {
            const message = await this.solanaMessage(ctx);
            await ctx.editMessageText(message, {
              parse_mode: 'HTML',
            });
          },
        );

      if (this.isEVM) {
        range.submenu(
          !account.xWalletPubKey
            ? 'Generate BASE Wallet'
            : 'Manage BASE Wallet',
          'base-wallet-menu',
          async (ctx: any) => {
            const message = await this.evmMessage(ctx);
            await ctx.editMessageText(message, {
              parse_mode: 'HTML',
            });
          },
        );
      }

      return range;
    });

    this.menu.register(solanaWallet);
    this.menu.register(baseWallet);
    this.bot.use(this.menu);
  }

  @SceneEnter()
  async onSceneEnter(ctx: Context) {
    // @ts-ignore
    const from = ctx.from || ctx.callback_query.from;
    await this.analyticsService.trackEvent(ANALYTICS_SCENE_VIEW, {
      scene: WALLET_SCENE,
      userId: from.id,
    });

    const message = await this.mainMessage(ctx);
    await ctx.replyWithHTML(message, {
      reply_markup: this.menu,
    });
  }

  async mainMessage(ctx) {
    const from =
      ctx?.from ||
      ctx?.callbackQuery?.from ||
      ctx?.update?.callback_query?.from;
    const account = await this.accountService.get(`${from.id}`);
    const accountWallets = [account.walletPubKey];
    if (this.isEVM) {
      accountWallets.push(account.xWalletPubKey);
    }
    const wallets =
      await this.blockchainMainService.getBalances(accountWallets);

    const wallet = wallets
      .map((wallet) => {
        return (
          `\n\n${wallet.name} Address: <code>${wallet.address}</code>\n` +
          `Treasury Balance: ${wallet.balance} ${wallet.symbol}\n\n` +
          `Tap to copy the address and send ${wallet.symbol} to deposit`
        );
      })
      .join('');

    return `<b>Wallet:</b>${wallet}`;
  }

  async solanaMessage(ctx) {
    ctx.session.selectedWallet = 'sol';

    const from =
      ctx?.from ||
      ctx?.callbackQuery?.from ||
      ctx?.update?.callback_query?.from;

    const account = await this.accountService.get(`${from.id}`);
    const wallet = await this.blockchainMainService.getBalance(
      account.walletPubKey,
    );

    return (
      `<b>Wallet:</b>\n\n` +
      `Address: <code>${account.walletPubKey}</code>\n` +
      `Treasury Balance: ${wallet.balance} ${wallet.symbol}\n\n` +
      `Tap to copy the address and send ${wallet.symbol} to deposit`
    );
  }

  async evmMessage(ctx) {
    const from =
      ctx?.from ||
      ctx?.callbackQuery?.from ||
      ctx?.update?.callback_query?.from;

    ctx.session.selectedWallet = 'evm';

    let account = await this.accountService.get(`${from.id}`);

    if (!account.xWalletPubKey) {
      account = await this.accountService.setChain(`${from.id}`, 'base');
    }

    const wallet = await this.blockchainMainService.getBalance(
      account.xWalletPubKey,
    );

    return (
      `<b>Wallet:</b>\n\n` +
      `Address: <code>${account.xWalletPubKey}</code>\n` +
      `Treasury Balance: ${wallet.balance} ${wallet.symbol}\n\n` +
      `Tap to copy the address and send ${wallet.symbol} to deposit`
    );
  }
}
