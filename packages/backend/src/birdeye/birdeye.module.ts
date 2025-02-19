import { Module } from '@nestjs/common';
import { BirdEyeService } from './birdeye.service';

@Module({
  providers: [BirdEyeService],
  exports: [BirdEyeService],
})
export class BirdEyeModule {}
