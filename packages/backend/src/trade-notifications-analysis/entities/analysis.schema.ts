import { z } from 'zod';

export const AnalysisMetaSchema = z.object({
  tokenAddress: z.string(),
  title: z.string(),
  category: z.string(),
  rating: z.number(),
  headline: z.string(),
  tags: z.string().array(),
  message: z.string(),
  reasoning: z.string(),
  data: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AnalysisTrendSchema = z.object({
  headline: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
