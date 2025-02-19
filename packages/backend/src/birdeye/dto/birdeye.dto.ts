export class BirdeyeTokenItemDto {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  uiAmount: number;
  chainId: string;
  logoURI: string;
  priceUsd: number;
  valueUsd: number;
}

export class BirdeyeWalletDataDto {
  wallet: string;
  totalUsd: number;
  items: BirdeyeTokenItemDto[];
}

export class BirdeyeWalletResponse {
  success: boolean;
  data: BirdeyeWalletDataDto;
}
