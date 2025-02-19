export class DexScreenerPairs {
  dexId: string;
  pairAddress: string;

  chainId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };

  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };

  volume: {
    h24: number;
  };

  priceChange: {
    h24: number;
  };

  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };

  priceUsd: string;

  fdv: number;

  info: {
    imageUrl: string;
    websites: Array<Record<string, string>>;
    socials: Array<Record<string, string>>;
  };
}

export class DexScreener {
  pairs: Array<DexScreenerPairs>;
}
