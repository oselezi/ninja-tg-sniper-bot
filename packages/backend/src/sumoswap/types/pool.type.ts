export type EvaluatePool = {
  id: string;
  quoteLoteSize: bigint;
  baseLoteSize: bigint;
  quoteVaultBalance: number;
  baseVaultBalance: number;
  swapQuoteInAmount: bigint;
  swapQuoteOutAmount: bigint;
  swapBaseInAmount: bigint;
  swapBaseOutAmount: bigint;
  liquidity?: number;
  activity?: number;
};
