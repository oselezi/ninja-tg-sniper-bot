import { z } from 'zod';
import { AccountSchema } from '../../account/entities/account.schema';
import { WAITLIST_SCENE } from '../constants';
import { CHAIN } from '../../config/constants';

export const isAccountEnabled = (ctx) => {
  const enabled = ctx.session.account ? ctx.session.account.enabled : false;
  if (!enabled) {
    ctx.scene.enter(WAITLIST_SCENE);
    return false;
  }
  return true;
};

export function sortByTokenAmount(data: any[], tokenType: string) {
  return data.sort((a, b) => {
    let amountA, amountB;

    switch (tokenType) {
      case 'solana':
        amountA = Number(a.token.amount);
        amountB = Number(b.token.amount);
        break;
      case 'evm':
        amountA = a.uiAmount;
        amountB = b.uiAmount;
        break;
    }

    return amountB - amountA;
  });
}

export function getReferralLink(startPayload) {
  return startPayload?.startsWith('ref_') ? startPayload.split('_')[1] : '';
}

export function getContractAddress(startPayload) {
  const regex = /_ca_(.+)/;
  const match = startPayload.match(regex);

  if (match && match.length > 1) {
    return match[1];
  }

  return '';
}

type GatefiUrlParams = {
  account: z.infer<typeof AccountSchema>;
};

export function getGatefiURL({ account }: GatefiUrlParams) {
  const walletAddress = account.walletPubKey;
  const userId = account.userId;
  const timestamp = Date.now();
  return `${process.env.GATEFI_URL}?merchantId=${process.env.GATEFI_MERCHANTID}&cryptoCurrency=SOL_SOL&cryptoCurrencyLock=true&wallet=${walletAddress}&walletLock=true&externalId=${userId}_${timestamp}`;
}
