import { limit } from '@grammyjs/ratelimiter';
import Redis from 'ioredis';

const limitConfig = {
  timeFrame: process.env.NODE_ENV == 'production' ? 1500 : 10,
  limit: 3,
  onLimitExceeded: (ctx, next) =>
    ctx.reply(
      'Slow down there Ninja, you are moving too fast! You have hit the rate limit - cool down or try one of the other backup bots.',
    ),
};

export default ({ storageClient }) =>
  limit({
    ...limitConfig,
    storageClient: storageClient ? new Redis(storageClient) : undefined,
  });
