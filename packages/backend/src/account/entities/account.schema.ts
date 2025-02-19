import { z } from 'zod';
import { DEFAULT_SETTINGS } from '../types/settings.types';

export const AccountSchema = z.object({
  username: z.string(),
  userId: z.string(),
  groupId: z.string().optional(),
  referredBy: z.string().optional(),
  referralId: z.string().optional(),
  lastSeenAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  walletPubKey: z.string(),
  walletPrivateKey: z.string(),
  enabledAccount: z.boolean().default(false),
  enabledAccountAt: z.date().optional(),
  referralCount: z.number().default(0).optional(),
  waitlistPosition: z.number().default(0),
  settings: z
    .object({
      announcements_enabled: z
        .boolean()
        .default(DEFAULT_SETTINGS.announcements_enabled),
      min_pos_value: z.number().default(DEFAULT_SETTINGS.min_pos_value),
      auto_buy_enabled: z.boolean().default(DEFAULT_SETTINGS.auto_buy_enabled),
      auto_buy_amount: z.number().default(DEFAULT_SETTINGS.auto_buy_amount),
      buy_button_left: z.number().default(DEFAULT_SETTINGS.buy_button_left),
      buy_button_right: z.number().default(DEFAULT_SETTINGS.buy_button_right),
      sell_button_left: z.number().default(DEFAULT_SETTINGS.sell_button_left),
      sell_button_right: z.number().default(DEFAULT_SETTINGS.sell_button_right),
      slippage_config_buy: z
        .number()
        .default(DEFAULT_SETTINGS.slippage_config_buy),
      slippage_config_sell: z
        .number()
        .default(DEFAULT_SETTINGS.slippage_config_sell),
      max_price_impact: z.number().default(DEFAULT_SETTINGS.max_price_impact),
      mev_protect: z.string().default(DEFAULT_SETTINGS.mev_protect),
      transaction_priority: z
        .string()
        .default(DEFAULT_SETTINGS.transaction_priority),
      transaction_priority_amount: z
        .number()
        .default(DEFAULT_SETTINGS.transaction_priority_amount),
      swap_provider: z.string().default(DEFAULT_SETTINGS.swap_provider),
    })
    .optional(),

  // EVM chain
  xWalletPubKey: z.string().optional(),
  xWalletPrivateKey: z.string().optional(),
  runtime: z.string().optional(),
  chain: z.string().optional(),
});
