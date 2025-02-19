import { expect, test } from 'bun:test';
import { Connection } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import { SumoSwap } from './sumoswap.class';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const sumoSwap = new SumoSwap(connection, new Wallet(Keypair.generate()), 3);

test('10SOL w/ commission ', () => {
  const { totalSOL, amountInOut, commissionRate, commissionAmount } =
    sumoSwap.calcTransactionAmountsInOut(10, true);

  console.log({
    totalSOL: totalSOL.toNumber(),
    amountInOut: amountInOut.toNumber(),
    commissionRate: commissionRate.toNumber(),
    commissionAmount: commissionAmount.toNumber(),
  });
  expect(totalSOL.toNumber()).toBe(10);
  expect(amountInOut.toNumber()).toBe(9.9);

  expect(commissionRate.toNumber()).toBe(0.01);
  expect(commissionAmount.toNumber()).toBe(0.1);
});
