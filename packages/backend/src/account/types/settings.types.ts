export const TRANSACTION_PRIORITY_AMOUNT = {
  low: 0.0015,
  medium: 0.0075,
  high: 0.015,
};

export const DEFAULT_SETTINGS = {
  announcements_enabled: false,
  min_pos_value: 0.001,
  auto_buy_enabled: false,
  auto_buy_amount: 0.1,
  buy_button_left: 1,
  buy_button_right: 5,
  sell_button_left: 10,
  sell_button_right: 25,
  slippage_config_buy: 10,
  slippage_config_sell: 10,
  max_price_impact: 25,
  mev_protect: 'turbo',
  transaction_priority: 'high',
  transaction_priority_amount: TRANSACTION_PRIORITY_AMOUNT['high'],
  swap_provider: 'jupiter',
};

export const TRANSACTION_PRIORITY_LEVELS = ['low', 'medium', 'high'];
