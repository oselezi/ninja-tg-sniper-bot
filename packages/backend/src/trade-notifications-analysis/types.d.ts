export type TradeAnalysis = {
  tokenAddress: string;
  title: string;
  category: string;
  rating: number;
  headline: string;
  tags: string[];
  message: string;
  reasoning: string;
};

export type TradeTrend = {
  headline: string;
  description: string;
  notes?: string;
  createAt: date;
};

export interface TradeAnalysisMeta extends TradeAnalysis {
  tokenAddress: string;
  createdAt: date;
}
