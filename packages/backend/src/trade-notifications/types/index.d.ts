export type TokenEventType = {
  mint: string;
  name: string;
  symbol: string;
  rating: number;
  image?: string;
  description?: string;
  message?: string;
  baseMint: string;
  botId?: string;
};

export interface TokenEventTypeWithAi extends TokenEventType {
  aiTitle: string;
  aiCategory: string;
  aiRating: number;
  aiHeadline: string;
  aiTags: string[];
  aiMessage: string;
  aiReasoning: string;
}
