import { config } from 'dotenv';
import * as crypto from 'crypto';
import * as numeral from 'numeral';
import { get } from 'lodash';
import * as theme from './config/theme.json';

export const isGCP =
  process.env.GAE_ENV ||
  process.env.K_SERVICE ||
  process.env.GOOGLE_CLOUD_PROJECT;

if (!isGCP) {
  config();
}
export const isWebhookEnabled = process.env.WEBHOOK_ENABLED === 'true';

export function formatCurrency(value: number, opts?: Intl.NumberFormatOptions) {
  if (!value) return '-';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    ...(opts || {}),
  });
}

export function formatPercentage(value: number) {
  if (!value) return '-';
  return numeral(value).divide(100).format('0.00%');
}

export function formatShortCurrency(value: number) {
  if (!value) return '-';
  let suffix = '';
  let formatted = value.toString();

  if (value >= 1e9) {
    suffix = 'B';
    formatted = (value / 1e9).toFixed(1);
  } else if (value >= 1e6) {
    suffix = 'M';
    formatted = (value / 1e6).toFixed(1);
  } else if (value >= 1e3) {
    suffix = 'K';
    formatted = (value / 1e3).toFixed(1);
  } else {
    return value.toFixed(0);
  }

  return `$${formatted}${suffix}`;
}

export function resolve<T, E>(
  promise: Promise<T>,
): Promise<[E, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[E, undefined]>((err: E) => [err, undefined]);
}

export function encryptDecryptText() {
  const secret = process.env.SEED_KEY || 'ninja-bot';

  return {
    encrypt: async (plaintext: string) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        crypto
          .createHash('sha256')
          .update(String(secret))
          .digest('base64')
          .substr(0, 32),
        iv,
      );

      let encrypted = cipher.update(plaintext);

      encrypted = Buffer.concat([encrypted, cipher.final()]);

      return iv.toString('hex') + ':' + encrypted.toString('hex');
    },
    decrypt: async (ciphertext: string) => {
      if (!ciphertext) return '';
      try {
        const textParts = ciphertext.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(
          'aes-256-cbc',
          crypto
            .createHash('sha256')
            .update(String(secret))
            .digest('base64')
            .substr(0, 32),
          iv,
        );
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
      } catch (error) {
        // console.error('Error decrypting', error);
        return ciphertext;
      }
    },
  };
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

export function removeEmoji(str) {
  let strCopy = str;
  const emojiKeycapRegex = /[\u0023-\u0039]\ufe0f?\u20e3/g;
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const emojiComponentRegex = /\p{Emoji_Component}/gu;
  if (emojiKeycapRegex.test(strCopy)) {
    strCopy = strCopy.replace(emojiKeycapRegex, '');
  }
  if (emojiRegex.test(strCopy)) {
    strCopy = strCopy.replace(emojiRegex, '');
  }
  if (emojiComponentRegex.test(strCopy)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const emoji of strCopy.match(emojiComponentRegex) || []) {
      if (/[\d|*|#]/.test(emoji)) {
        continue;
      }
      strCopy = strCopy.replace(emoji, '');
    }
  }

  return strCopy;
}

export function isEVMEnabled() {
  return process.env.EVM_ENABLED === 'true';
}

export function isEVMAddress(address: string) {
  return address.startsWith('0x');
}

export function isEVMTestNet() {
  return process.env.EVM_RPC_URL?.includes('sepolia');
}

export function convertToDecimal(value: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  const leadingDigit = Math.floor(value / factor);
  const adjustedValue = (value - leadingDigit * factor) / factor;
  return leadingDigit + adjustedValue;
}

export function convertEvmTokenFromNative(evmToken: string): string {
  return evmToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    ? '0x4200000000000000000000000000000000000006'
    : evmToken;
}

export function toDeadline(expiration: number): number {
  return Math.floor((Date.now() + expiration) / 1000);
}

export function snakeCase(string = '') {
  return string
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .join('_');
}

export function formatDataProperties(data: any) {
  const dataObj: any = {};
  Object.keys(data || {}).forEach((key) => {
    if (!!data[key] && typeof data[key] !== 'undefined') {
      const _key = snakeCase(key);
      dataObj[_key] = data[key];
    }
  });

  return dataObj;
}

export function t(key: string) {
  return get(theme, `${process.env.THEME || 'ninja'}.${key}`, key);
}
