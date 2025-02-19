export class Token {
  dexId: string;
  pairAddress: string;
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
  priceNative: string;
  priceUsd: string;
  mktCap: {
    value: number;
    formatted: string;
  };
  volume24h: {
    value: number;
    formatted: string;
  };
  change5m: {
    value: number;
    formatted: string;
  };
  change6h: {
    value: number;
    formatted: string;
  };
  change1h: {
    value: number;
    formatted: string;
  };
  change24h: {
    value: number;
    formatted: string;
  };
  liquidity: {
    usd: {
      value: number;
      formatted: string;
    };
    base: {
      value: number;
      formatted: string;
    };
    quote: {
      value: number;
      formatted: string;
    };
  };
  twitter: string;
  website: string;
  telegram: string;
}
