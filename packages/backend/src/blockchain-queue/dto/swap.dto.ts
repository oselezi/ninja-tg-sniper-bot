// import { Wallet } from '@project-serum/anchor';

// export class SwapDTO {
//   wallet: Wallet;
//   inputMint: string;
//   outputMint: string;
//   solAmount: number;
// }

export class UserSwapDTO {
  groupId: string;
  botId: string;
  userId: string;
}

export class CreateSwapDTO extends UserSwapDTO {
  symbol: string;
  inputMint: string;
  outputMint: string;
  solAmount: number;
  priorityFeeAmount: number;
  // swapProvider: 'sumo' | 'jupiter';
}

export class SwapDTO extends UserSwapDTO {
  side: 'buy' | 'sell';
  token: string;
  symbol: string;
  amountIn: number;
  amountOut: number;
  txnId: string;
  messageId: string;
  username?: string;
}
