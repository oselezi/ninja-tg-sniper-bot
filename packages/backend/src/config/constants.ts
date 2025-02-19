export const SESSION_DB = 'session';

const WEBHOOK_PATH = process.env.WEBHOOK_PATH;
const PUBLIC_URL = process.env.PUBLIC_URL;

export const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

export enum CHAIN {
  EVM = 'evm',
  SOLANA = 'solana',
}
