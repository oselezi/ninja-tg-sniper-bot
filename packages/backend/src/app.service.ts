import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      service: 'ninja-bot',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
