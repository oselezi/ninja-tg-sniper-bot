import { Update } from '@grammyjs/nestjs';
import { SINGLE_MORE_SCENE } from '../constants';
import { Scene, SceneEnter } from './library/decorators/scene.decorator';
import { InlineKeyboard } from 'grammy';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { DexScreenerService } from '../../dexscreener/dexscreener.service';
import { capitalize, formatShortCurrency, isEVMAddress } from '../../util';
import BigNumber from 'bignumber.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

@Update()
@Scene(SINGLE_MORE_SCENE)
export class SingleMoreScene {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly dexScreenerService: DexScreenerService,
  ) {}

  @SceneEnter()
  async enter(ctx) {
    const inlineKeyboard = new InlineKeyboard().text(
      ' ⬅️ Back',
      'single_more_back',
    );

    const { symbol, token } = ctx.session.data;

    const [[lookup], tokenMetadata] = await Promise.all([
      this.dexScreenerService.lookupToken(token),
      this.blockchainService.getMetadataByToken(token),
    ]);

    const noneMintAuthority = String(
      tokenMetadata.mint.mintAuthority['__option'] === 'None',
    );
    const noneFreezeAuthority = String(
      tokenMetadata.mint.freezeAuthority['__option'] === 'None',
    );
    const noneMutable = String(
      noneMintAuthority === 'true' && noneFreezeAuthority === 'true',
    );

    console.log('---------> tokenMetadata.mint', tokenMetadata.mint);

    const emoji = {
      true: '✅',
      false: '❌',
    };

    let totalSupply = new BigNumber(tokenMetadata.mint.supply.toString());

    if (!isEVMAddress(token)) {
      totalSupply = totalSupply.dividedBy(
        tokenMetadata.mint?.decimals > 0
          ? tokenMetadata.mint?.decimals
          : LAMPORTS_PER_SOL,
      );
    }

    await ctx.replyWithHTML(
      `⚖️ Pair:  <strong>${symbol}/${isEVMAddress(token) ? 'ETH' : 'SOL'}</strong>\n` +
        `🕹️ Platform: ${capitalize(lookup.dexId)}\n` +
        `🔀 Supply: ${formatShortCurrency(totalSupply.toNumber())}\n\n` +
        // `📈 Supply in Pool: 90.00%\n\n` +
        `💲 Market Cap: ${lookup.mktCap.formatted}\n` +
        `💧Liquidity: ${lookup.liquidity.usd.formatted}\n\n` +
        `Risk Score\n` +
        `${emoji[noneMintAuthority]} Mint Revoked: ${capitalize(noneMintAuthority)}\n` +
        `${emoji[noneFreezeAuthority]} Freeze Revoked: ${capitalize(noneFreezeAuthority)}\n` +
        `${emoji[noneMutable]} Immutable: ${capitalize(noneMutable)}\n` +
        // `✅ LP Burn: Yes\n\n` +
        `---\n\n` +
        `Base: ${lookup.pairAddress}\n` +
        `Quote: ${lookup.quoteToken.address} \n\n` +
        `<a href="https://${
          isEVMAddress(token) ? 'basescan.org/address' : 'solscan.io/token'
        }/${token}">View on Explorer</a>\n`,
      {
        reply_markup: inlineKeyboard,
        link_preview_options: {
          is_disabled: true,
        },
      },
    );

    await ctx.scene.exit();
  }
}
