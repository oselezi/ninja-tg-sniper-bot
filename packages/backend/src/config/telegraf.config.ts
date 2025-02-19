import { registerAs } from '@nestjs/config';

export default registerAs('TELEGRAM', () => ({
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
}));
