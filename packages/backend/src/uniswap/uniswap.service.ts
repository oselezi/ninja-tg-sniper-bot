import { Injectable } from '@nestjs/common';
import { Wallet } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Uniswap } from './uniswap.class';
import { convertToDecimal, isEVMTestNet } from '../util';

@Injectable()
export class UniswapService {
  constructor() {}

  async swap(
    wallet: Wallet,
    inputToken: string,
    outputToken: string,
    amountIn: string,
  ) {
    const [inputTokenDecimals, outputTokenDecimals] = await Promise.all([
      Uniswap.getDecimals(inputToken, wallet.provider),
      Uniswap.getDecimals(outputToken, wallet.provider),
    ]);
    const uniswap = new Uniswap(isEVMTestNet() ? 'sepolia' : 'mainnet');
    const config = uniswap.getConfig();

    const tokenIn = new Token(config.chain_id, inputToken, inputTokenDecimals);
    const tokenOut = new Token(
      config.chain_id,
      outputToken,
      outputTokenDecimals,
    );

    const provider = wallet.provider;
    const pool = await uniswap.getPool({
      provider,
      tokenIn,
      tokenOut,
    });

    const route = await uniswap.getRoute({
      pool,
      tokenIn,
      tokenOut,
    });

    const amountOut = await uniswap.getQuote({
      provider,
      route,
      tokenIn,
      amountIn,
    });

    console.log(
      'Amount out:',
      convertToDecimal(Number(amountOut), outputTokenDecimals),
    );

    const swap = await uniswap.swap({
      wallet,
      tokenIn,
      tokenOut,
      amountIn,
    });

    console.log({ swap });

    return {
      ...swap,
      amountOut: convertToDecimal(Number(amountOut), outputTokenDecimals),
    };
  }
}
