import { Injectable } from '@nestjs/common';
import { DexScreener } from './dto/dexscreener.dto';
import { Token } from './dto/token.dto';
import { formatShortCurrency, formatPercentage } from '@/util';
import { Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { get } from 'lodash';
import { axios } from '@/cache';
import { isEVMAddress } from '../util';

export const EMPTY_TOKEN: Token = {
  dexId: '',
  pairAddress: '',
  quoteToken: {
    address: '',
    name: '',
    symbol: '',
  },
  liquidity: {
    base: {
      value: 0,
      formatted: '-',
    },
    quote: {
      value: 0,
      formatted: '-',
    },
    usd: {
      value: 0,
      formatted: '-',
    },
  },
  baseToken: {
    address: '',
    name: '',
    symbol: '',
  },
  priceNative: '0',
  priceUsd: '0',
  mktCap: {
    value: 0,
    formatted: '-',
  },
  volume24h: {
    value: 0,
    formatted: '-',
  },
  change5m: {
    value: 0,
    formatted: '-',
  },
  change6h: {
    value: 0,
    formatted: '-',
  },
  change24h: {
    value: 0,
    formatted: '-',
  },
  change1h: {
    value: 0,
    formatted: '-',
  },
  twitter: '',
  telegram: '',
  website: '',
};

@Injectable()
export class DexScreenerService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios;
  }

  logger = new Logger(DexScreenerService.name);

  async lookupToken(tokenId: string | string[], fromPairs: boolean = false) {
    try {
      this.logger.debug('Looking up token', tokenId);

      const addressesArray = Array.isArray(tokenId) ? tokenId : [tokenId];
      const chunkSize = 30;
      const chunks = [];

      for (let i = 0; i < addressesArray.length; i += chunkSize) {
        chunks.push(addressesArray.slice(i, i + chunkSize));
      }

      const chain = isEVMAddress(addressesArray[0]) ? 'base' : 'solana';

      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const addressess = chunk.join(',');

          const [responsePair, responseToken] = await Promise.all([
            this.api.get<DexScreener>(
              `https://api.dexscreener.com/latest/dex/pairs/${chain}/${addressess}`,
            ),
            this.api.get<DexScreener>(
              `https://api.dexscreener.com/latest/dex/tokens/${addressess}`,
            ),
          ]);

          const result = []
            .concat(responsePair.data.pairs || [])
            .concat(responseToken.data.pairs || []);

          return result || [];
        }),
      );

      const tokens = results
        .flat()
        .filter(
          (pair) =>
            (pair.dexId === 'raydium' && pair.chainId === 'solana') ||
            pair.chainId === 'base',
        )
        .map((pair) => {
          const volume24h = get(pair, 'volume.h24', 0);
          const change24h = get(pair, 'priceChange.h24', 0);
          const change1h = get(pair, 'priceChange.h1', 0);
          const change5m = get(pair, 'priceChange.m5', 0);
          const change6h = get(pair, 'priceChange.h6', 0);
          const mktCap = get(pair, 'fdv', 0);
          const socials = get(pair, 'info.socials', []);
          const websites = get(pair, 'info.websites', []);

          const liquidityBase = get(pair, 'liquidity.base', 0);
          const liquidityQuote = get(pair, 'liquidity.quote', 0);
          const liquidityUsd = get(pair, 'liquidity.usd', 0);

          const token: Token = {
            dexId: get(pair, 'dexId'),
            pairAddress: get(pair, 'pairAddress'),
            quoteToken: {
              address: get(pair, 'quoteToken.address'),
              name: get(pair, 'quoteToken.name'),
              symbol: get(pair, 'quoteToken.symbol'),
            },
            liquidity: {
              base: {
                value: liquidityBase,
                formatted: formatShortCurrency(liquidityBase),
              },
              quote: {
                value: liquidityQuote,
                formatted: formatShortCurrency(liquidityQuote),
              },
              usd: {
                value: liquidityUsd,
                formatted: formatShortCurrency(liquidityUsd),
              },
            },
            baseToken: {
              address: get(pair, 'baseToken.address'),
              name: get(pair, 'baseToken.name'),
              symbol: get(pair, 'baseToken.symbol'),
            },
            priceNative: get(pair, 'priceNative', '0'),
            priceUsd: get(pair, 'priceUsd', '0'),
            mktCap: {
              value: mktCap,
              formatted: formatShortCurrency(mktCap),
            },
            volume24h: {
              value: volume24h,
              formatted: formatShortCurrency(volume24h),
            },
            change5m: {
              value: change5m,
              formatted: formatPercentage(change5m),
            },
            change6h: {
              value: change6h,
              formatted: formatPercentage(change6h),
            },
            change24h: {
              value: change24h,
              formatted: formatPercentage(change24h),
            },
            change1h: {
              value: change1h,
              formatted: formatPercentage(change1h),
            },
            twitter: socials.find((social) => social['type'] === 'twitter')
              ?.url,
            telegram: socials.find((social) => social['type'] === 'telegram')
              ?.url,
            website: websites?.[0]?.url,
          };

          return token;
        });

      return tokens.length ? tokens : [EMPTY_TOKEN];
    } catch (error) {
      this.logger.debug(error, 'DEXSCREENER_ERROR');
      return [EMPTY_TOKEN];
    }
  }
}
