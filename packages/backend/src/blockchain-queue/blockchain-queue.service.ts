import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BLOCKCHAIN_QUEUE_NAME } from './constants';

import { CreateSwapDTO, SwapDTO } from './dto/swap.dto';
import { ConfirmBurnDTO } from './dto/burn.dto';
import { ConfirmTransferDTO } from './dto/trasnfer.dto';

@Injectable()
export class BlockchainQueueService {
  private readonly logger = new Logger(BlockchainQueueService.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue(BLOCKCHAIN_QUEUE_NAME) private blockchainQueue: Queue,
  ) {
    this.init();
  }

  async init() {
    if (this.configService.get('NODE_ENV') === 'production') {
      try {
        await this.delay(1000, 1);
        this.checkQueueAvailability();
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  delay(t: number, val: any) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(val);
      }, t);
    });
  }

  private checkQueueAvailability(): void {
    if (this.blockchainQueue.client.status === 'ready') {
      this.logger.log('Redis is ready');
    } else {
      throw new Error('Redis not available');
    }
  }

  createSwap = async (data: CreateSwapDTO) => {
    this.logger.debug(`Creating swap: ${JSON.stringify(data)}`);
    return this.blockchainQueue.add('swap.create', data);
  };

  swapConfirm = async (data: SwapDTO) => {
    this.logger.debug(`Creating transaction: ${JSON.stringify(data)}`);
    return this.blockchainQueue.add('swap.confirm', data);
  };

  createReferralAccount = async (data: any) => {
    this.logger.debug(`Creating referral account: ${JSON.stringify(data)}`);
    return this.blockchainQueue.add('referral.create', data);
  };

  burnConfirm = async (data: ConfirmBurnDTO) => {
    this.logger.debug(`Confirm burn: ${JSON.stringify(data)}`);
    return this.blockchainQueue.add('burn.confirm', data);
  };

  transferConfirm = async (data: ConfirmTransferDTO) => {
    this.logger.debug(`Confirm transfer: ${JSON.stringify(data)}`);
    return this.blockchainQueue.add('transfer.confirm', data);
  };
}
