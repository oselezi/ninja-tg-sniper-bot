import { Wallet } from '@project-serum/anchor';

export class SwapDTO {
  wallet: Wallet;
  inputMint: string;
  outputMint: string;
  solAmount: number;
}
