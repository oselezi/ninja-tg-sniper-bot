import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  FirestoreService,
  FirestoreCRUD,
} from '../firestore/firestore.service';
import { z } from 'zod';

import {
  AnalysisMetaSchema,
  AnalysisTrendSchema,
} from './entities/analysis.schema';

import { TradeAnalysis, TradeAnalysisMeta, TradeTrend } from './types.d';
import { kebabCase } from 'lodash';
import { removeEmoji } from '../util';

import {
  metaAnalysisPrompt,
  TokenMetaSummary,
} from './prompts/meta-analysis.prompt';
import { LatestMetaFilterDTO } from './dtos/latest-filter.dto';

@Injectable()
export class TradeNotificationsAnalysisService {
  openai: OpenAI;
  private analysisMeta: FirestoreCRUD<z.infer<typeof AnalysisMetaSchema>>;
  private analysisTrend: FirestoreCRUD<z.infer<typeof AnalysisTrendSchema>>;

  constructor(private firestoreService: FirestoreService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
    });
    this.analysisMeta = this.firestoreService.collection(
      'analysis-meta',
      AnalysisMetaSchema,
    );
    this.analysisTrend = this.firestoreService.collection(
      'analysis-trends',
      AnalysisTrendSchema,
    );
  }
  async generateAnalysisForMeta(
    tokenAddress: string,
    text: string,
  ): Promise<TradeAnalysis> {
    const trends = await this.getLatestTrend();
    const prompt = metaAnalysisPrompt({
      trendingMetas: trends.description,
      tokenMeta: text,
      notes: trends.notes || '',
    });

    const { choices } = await this.openai.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      response_format: {
        type: 'json_object',
      },
      model: 'gpt-3.5-turbo-0125',
    });

    const analysisText = choices[0];

    const response = JSON.parse(
      analysisText?.message?.content,
    ) as TokenMetaSummary;

    // Extract rating, headline, and excerpt from analysisText
    // This extraction depends on the structured response from OpenAI, which needs to be parsed accordingly.
    // Example parsing (pseudo-code):

    const title = response?.meta?.title || '';
    const category = kebabCase(response?.meta?.category || '');
    const headline = response.status || '';
    const similarTokens = response?.meta?.similarTokens || [];
    const interestLevel = +response?.meta?.interestLevel || 0;
    const message = response.message || '';
    const reasoning = response.reasoning || '';

    const similarTokensSlugs = similarTokens.map((i) => kebabCase(i));

    await this.analysisMeta.create(tokenAddress, {
      tokenAddress: tokenAddress,
      title: title,
      category: category,
      rating: interestLevel,
      headline: headline,
      tags: similarTokensSlugs,
      message: message,
      reasoning: reasoning,
      data: JSON.parse(text),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      tokenAddress: tokenAddress,
      title: title,
      category: category,
      rating: interestLevel,
      headline: headline,
      tags: similarTokensSlugs,
      reasoning: reasoning,
      message: message,
    };
  }

  extractCategoryFromMeta(trend: string): string {
    // Use a regex that matches the entire trend entry up to the first '|',
    // then extract the category name directly.
    const match = removeEmoji(trend);
    if (!match) return ''; // Return empty string if no match is found

    // Extract the category name, which is between the emoji and the first '|'
    const category = match.split('|')[0].trim(); // Trim any whitespace

    return kebabCase(category);
  }

  async getLatestTrendParsed() {
    const trend = await this.getLatestTrend();
    let firstMeta = '';
    const tags = [];
    const parsedTrends = trend.description.split('\n').map((line, index) => {
      if (index == 0) {
        firstMeta = line;
      }
      tags.push(this.extractCategoryFromMeta(line));
      return `/${index + 1} ${line} \n`;
    });
    return {
      firstMeta,
      parsedTrends,
      tags,
    };
  }

  async getLatestTrend(): Promise<TradeTrend> {
    const query = await this.analysisTrend.rawCollection
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    return query?.docs[0]?.data() as TradeTrend;
  }

  async getLatestMetas(): Promise<TradeAnalysisMeta[]> {
    const query = await this.analysisMeta.rawCollection
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const data = query?.docs.map((d) => {
      return d.data();
    });

    return data as TradeAnalysisMeta[];
  }

  async getLatestMetasTopRated(
    input?: LatestMetaFilterDTO,
  ): Promise<TradeAnalysisMeta[]> {
    const limit = input?.limit || 8;
    const offset = input?.offset || 0;
    const filter = input.filter || 'all';

    let query = this.analysisMeta.rawCollection
      .orderBy('createdAt', 'desc')
      .orderBy('rating', 'desc')
      .offset(offset)
      .limit(limit);

    if (filter === 'matched') {
      query = query.where('rating', '>', 0);
    }

    const result = await query.get();

    const data = result?.docs.map((d) => {
      return d.data();
    });

    return data as TradeAnalysisMeta[];
  }

  // TODO: Generate using an API
  // Pull in Dexscreener
  // Parse the prompt
  async generateAnalysisForTrendings(document: any): Promise<void> {
    // Process the document to extract relevant data.
    // Use OpenAI API for analysis if needed.
    // Save the analysis to FirestoreDB.
  }
}
