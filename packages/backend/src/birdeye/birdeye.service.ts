import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { axios } from '@/cache';
import { AxiosInstance } from 'axios';
import { BirdeyeWalletResponse } from './dto/birdeye.dto';

@Injectable()
export class BirdEyeService {
  private api: AxiosInstance;
  constructor(private configService: ConfigService) {
    this.api = axios;
  }

  logger = new Logger(BirdEyeService.name);
  apiUrl = this.configService.get('BIRDEYE_API_URL');
  apiKey = this.configService.get('BIRDEYE_API_KEY');

  async fetchEVMWalletTokens(walletAddress: string) {
    try {
      const { data } = await this.api.get<BirdeyeWalletResponse>(
        `${this.apiUrl}/wallet/multichain_token_list?wallet=${walletAddress}`,
        {
          headers: {
            'x-chains': 'base',
            'X-API-KEY': this.apiKey,
          },
        },
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch wallet's token list: ${error}`);
    }
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string) {
    const { data } = await this.fetchEVMWalletTokens(walletAddress);

    const token = data.items.find((item) => item.address === tokenAddress);

    return {
      token: {
        amount: Number(token.uiAmount),
      },
      metadata: {
        symbol: token.symbol,
      },
    };
  }
}
