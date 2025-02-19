import { ChainId, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import {
  computePoolAddress,
  FeeAmount,
  Pool,
  Route,
  SwapQuoter,
} from '@uniswap/v3-sdk';
import { BigNumber, ethers, Wallet } from 'ethers';
import * as IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import * as SwapRouterABI from './swap-router.abi.json';

type GetPool = {
  provider: ethers.Signer | ethers.providers.Provider;
  tokenIn: Token;
  tokenOut: Token;
};

type GetQuote = {
  provider: ethers.Signer | ethers.providers.Provider;
  route: Route<Token, Token>;
  tokenIn: Token;
  amountIn: string;
};

type GetRoute = {
  pool: Pool;
  tokenIn: Token;
  tokenOut: Token;
};

type Swap = {
  tokenIn: Token;
  tokenOut: Token;
  wallet: Wallet;
  amountIn: string;
};

type Network = 'mainnet' | 'sepolia';

export class Uniswap {
  private network: Network = 'mainnet';

  private ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address recipient, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function permit(address owner, address token, address spender, uint160 amount, uint48 expiration, uint48 nonce) external returns (bool)',
    'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
    'function decimals() view returns (uint8)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
  ];

  //https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
  private config = {
    mainnet: {
      pool_factory_address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      quoter_address: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      swap_router_address: '0x2626664c2603336E57B271c5C0b26F421741e481',
      weth_address: '0x4200000000000000000000000000000000000006',
      permit2_address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      chain_id: ChainId.BASE,
    },
    sepolia: {
      pool_factory_address: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
      quoter_address: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',
      swap_router_address: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
      weth_address: '0x4200000000000000000000000000000000000006',
      permit2_address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      chain_id: 84532,
    },
  };

  /**
   *
   * @param network - Default network is mainnet
   */
  constructor(network?: Network) {
    this.network = network || 'mainnet';
  }

  static async getDecimals(
    address: string,
    provider: ethers.providers.Provider,
  ) {
    const contract = new ethers.Contract(
      address,
      ['function decimals() view returns (uint8)'],
      provider,
    );

    const decimals = await contract.decimals();

    return Number(decimals);
  }

  fromReadableAmount(amount: number | string, decimals = 18) {
    return ethers.utils.parseUnits(amount.toString(), decimals);
  }

  getConfig() {
    const config = this.config[this.network];

    if (!config) {
      throw new Error('Network not found');
    }

    return config;
  }

  async getPool({ provider, tokenIn, tokenOut }: GetPool) {
    const fee = FeeAmount.MEDIUM;

    const currentPoolAddress = computePoolAddress({
      factoryAddress: this.getConfig().pool_factory_address,
      tokenA: tokenIn,
      tokenB: tokenOut,
      fee,
    });

    const poolContract = new ethers.Contract(
      currentPoolAddress,
      IUniswapV3PoolABI.abi,
      provider,
    );

    const [liquidity, slot0] = await Promise.all([
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    const pool = new Pool(
      tokenIn,
      tokenOut,
      fee,
      slot0[0],
      liquidity,
      slot0[1],
    );

    return pool;
  }

  async getQuote({ provider, route, tokenIn, amountIn }: GetQuote) {
    const { calldata } = SwapQuoter.quoteCallParameters(
      route,
      CurrencyAmount.fromRawAmount(
        tokenIn,
        this.fromReadableAmount(amountIn, tokenIn.decimals).toString(),
      ),
      TradeType.EXACT_INPUT,
      {
        useQuoterV2: true,
      },
    );

    const quoteCallReturnData = await provider.call({
      to: this.getConfig().quoter_address,
      data: calldata,
    });

    return ethers.utils.defaultAbiCoder.decode(
      ['uint256'],
      quoteCallReturnData,
    );
  }

  async getRoute({ pool, tokenIn, tokenOut }: GetRoute) {
    const swapRoute = new Route([pool], tokenIn, tokenOut);

    return swapRoute;
  }

  async swap({ wallet, amountIn, tokenIn, tokenOut }: Swap) {
    const amount_in = this.fromReadableAmount(amountIn, tokenIn.decimals);
    const tokenInContract = new ethers.Contract(
      tokenIn.address,
      this.ERC20_ABI,
      wallet.provider,
    );

    const allowance = await tokenInContract.allowance(
      wallet.address,
      this.getConfig().swap_router_address,
    );
    console.log(
      `allowance: ${ethers.utils.formatUnits(allowance, tokenIn.decimals)}`,
    );

    if (BigNumber.from(allowance).lt(BigNumber.from(amount_in))) {
      console.log('call approve');
      const approve = await tokenInContract
        .connect(wallet)
        .approve(this.getConfig().swap_router_address, amount_in);
      await approve.wait();
      console.log('approve:', approve);
    }

    const swapContract = new ethers.Contract(
      this.getConfig().swap_router_address,
      SwapRouterABI,
      wallet.provider,
    );

    const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: FeeAmount.MEDIUM,
      recipient: wallet.address,
      amountIn: amount_in,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    const feeData = await wallet.provider.getFeeData();
    const gasPrice = BigNumber.from(feeData.gasPrice);
    console.log('gas price', gasPrice);

    const nonce = await wallet.provider.getTransactionCount(
      wallet.address,
      'latest',
    );
    console.log('nonce', nonce);

    const response = await swapContract
      .connect(wallet)
      .exactInputSingle(params, {
        gasLimit: 300_000,
        gasPrice: gasPrice.toNumber(),
        nonce,
        value: amount_in,
      });

    console.log('response', response);

    return {
      txId: response.hash,
      amountIn: Number(amountIn),
    };
  }
}
