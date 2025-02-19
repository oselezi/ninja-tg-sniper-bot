import { Injectable } from '@nestjs/common';
import * as solanaWeb3 from '@solana/web3.js';
import { z } from 'zod';
import * as bs58 from 'bs58';
import {
  FirestoreCRUD,
  FirestoreService,
} from '../firestore/firestore.service';
import { Wallet as WalletSol } from '@project-serum/anchor';
import { ethers, Wallet as WalletEth } from 'ethers';
import Web3 from 'web3';
import { encryptDecryptText } from '../util';
import { AccountSchema } from './entities/account.schema';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  ANALYTICS_LOGIN,
  ANALYTICS_REFERRAL,
  ANALYTICS_SIGNUP,
} from '@/analytics/analytics.types';
import { DEFAULT_SETTINGS } from '@/account/types/settings.types';
import { ConfigService } from '@nestjs/config';

export type AccountWallet = {
  solana: WalletSol;
  evm?: WalletEth;
};

@Injectable()
export class AccountService {
  private accounts: FirestoreCRUD<z.infer<typeof AccountSchema>>;
  private web3: Web3;
  constructor(
    private firestoreService: FirestoreService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {
    this.accounts = this.firestoreService.collection('accounts', AccountSchema);
    this.web3 = new Web3();
  }

  async get(userId: string): Promise<z.infer<typeof AccountSchema> | null> {
    const user = await this.accounts.get(userId);

    const { decrypt } = encryptDecryptText();

    const decryptedPrivateKey = await decrypt(user?.walletPrivateKey);

    let xWalletPrivateKey;
    if (user.xWalletPrivateKey) {
      xWalletPrivateKey = await decrypt(user.xWalletPrivateKey);
    }

    return {
      ...user,
      walletPrivateKey: decryptedPrivateKey,
      xWalletPrivateKey: xWalletPrivateKey,
    };
  }

  async update(
    userId: string,
    data: Partial<z.infer<typeof AccountSchema>>,
  ): Promise<void> {
    delete data.userId;
    delete data.createdAt;
    delete data.walletPrivateKey;

    await this.accounts.update(userId, data);
  }

  async createOrGetAccount(
    userId: string,
    username: string,
    metadata: Partial<z.infer<typeof AccountSchema>> = {},
  ): Promise<z.infer<typeof AccountSchema>> {
    // Attempt to retrieve the account from Firestore
    const existingAccount = await this.accounts.get(userId);

    if (existingAccount) {
      // DISABLED: Track login events for speed
      // await this.analyticsService.trackEvent(ANALYTICS_LOGIN, {
      //   userId,
      //   username,
      // });

      return existingAccount;
    }

    const { publicKey, privateKey } = await this.createNewWalletAddress();

    const waitlistPosition = await this.getLastAccountPosition();

    // If not existing, create a new account entity
    const newAccount = {
      userId,
      username,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      // Assuming these are placeholders and will be replaced
      referralId: this.generateReferralId(),
      groupId: metadata.groupId || '',
      referredBy: metadata.referredBy || '',
      walletPubKey: publicKey,
      walletPrivateKey: privateKey,
      enabledAccount: true,
      waitlistPosition: waitlistPosition + 1,
      runtime: 'solana',
    };

    // Validate new account data with Zod schema
    const validatedAccount = AccountSchema.parse(newAccount);

    await this.analyticsService.trackEvent(ANALYTICS_SIGNUP, {
      userId,
      username,
      waitlistPosition: validatedAccount.waitlistPosition,
      groupId: metadata.groupId || '',
      referredBy: metadata.referredBy || '',
    });

    if (metadata.referredBy) {
      const referredByCount = await this.getReferralCount(metadata.referredBy);
      await this.analyticsService.trackEvent(ANALYTICS_REFERRAL, {
        userId: metadata.referredBy,
        referredByCount: referredByCount,
      });
    }

    // Save the new account to Firestore
    await this.accounts.create(userId, validatedAccount);

    return validatedAccount;
  }
  async createNewWalletAddress(chain: string = 'solana'): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const { encrypt } = encryptDecryptText();
    switch (chain) {
      case 'solana': {
        // Generate a new keypair
        const keyPair = solanaWeb3.Keypair.generate();

        // Convert private key to a string or store securely
        const privateKey = keyPair.secretKey; // Convert Uint8Array to Array
        const publicKey = keyPair.publicKey.toString();
        const privateKeyHex = this.secretKeyToHex(privateKey);

        const encryptedPrivateKey = await encrypt(privateKeyHex);

        return {
          publicKey,
          privateKey: encryptedPrivateKey, // Convert array to string for easy storage
        };
      }
      case 'evm': {
        // Generate a new keypair
        const { address, privateKey } = this.web3.eth.accounts.create();
        const encryptedPrivateKey = await encrypt(privateKey.toString());
        return {
          publicKey: address,
          privateKey: encryptedPrivateKey, // Convert array to string for easy storage
        };
      }
    }
  }

  getAccountSettings = async (userId: string) => {
    const account = await this.accounts.get(userId);
    const settings = account.settings || DEFAULT_SETTINGS;
    return settings;
  };

  setChain = async (userId: string, chain: 'base' | 'solana') => {
    const runtime = chain === 'base' ? 'evm' : 'solana';

    // check setup

    const properties: Partial<z.infer<typeof AccountSchema>> = {
      runtime,
      chain: chain,
    };

    const user = await this.accounts.get(userId);

    if (!user.xWalletPubKey) {
      const { publicKey, privateKey } =
        await this.createNewWalletAddress('evm');
      properties.xWalletPubKey = publicKey;
      properties.xWalletPrivateKey = privateKey;
    }

    // update chain
    return this.accounts.update(userId, properties);
  };

  getKeypairFromString = (secretKeyString: string) => {
    let decodedSecretKey: Uint8Array;
    try {
      decodedSecretKey = bs58.decode(secretKeyString);
    } catch (throwObject) {
      throw new Error('Invalid secret key! See README.md');
    }
    return solanaWeb3.Keypair.fromSecretKey(decodedSecretKey);
  };

  secretKeyToHex = (secretKey: Uint8Array) => {
    return bs58.encode(secretKey);
  };

  getAccountWallet = async (userId: string): Promise<AccountWallet> => {
    const account = await this.accounts.get(userId);
    const { decrypt } = encryptDecryptText();
    if (!account) {
      throw new Error('Account not found');
    }

    const result = {} as AccountWallet;

    const solanaWallet = new WalletSol(
      solanaWeb3.Keypair.fromSecretKey(
        bs58.decode(await decrypt(account.walletPrivateKey)),
      ),
    );

    result.solana = solanaWallet;

    if (
      this.configService.get('EVM_ENABLED') === 'true' &&
      account.xWalletPrivateKey
    ) {
      const provider = new ethers.providers.JsonRpcProvider(
        this.configService.get('EVM_RPC_URL'),
      );
      const evmWallet = new WalletEth(
        await decrypt(account.xWalletPrivateKey),
        provider,
      );
      result.evm = evmWallet;
    }

    return result;
  };

  async getLastAccountPosition(): Promise<number> {
    const accounts = await this.accounts.rawCollection
      .where('waitlistPosition', '>', 0)
      .orderBy('waitlistPosition', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (accounts.empty) return 0;

    const [doc] = accounts.docs;
    const data = doc.data() as z.infer<typeof AccountSchema>;

    return data.waitlistPosition || 0;
  }

  async getOrCreateReferralLink(userId: string): Promise<string> {
    const account = await this.accounts.get(userId);

    if (!account) {
      throw new Error('Account not found');
    }

    if (account.referralId) {
      return account.referralId;
    }

    const referralId = this.generateReferralId();
    await this.accounts.update(userId, { referralId });

    return referralId;
  }

  generateReferralId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  async getReferralCount(referralId: string): Promise<number> {
    if (!referralId) return 0;
    const accounts = await this.accounts.rawCollection
      .where('referredBy', '==', referralId)
      .get();

    return accounts.size;
  }
}
