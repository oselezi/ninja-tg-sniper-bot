import { Wallet } from '@project-serum/anchor';

export class SwapDTO {
  wallet: Wallet;
  amount: number;
  inputToken: string;
  outputToken: string;
}
