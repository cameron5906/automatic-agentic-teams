import { config } from '../config';
import type { TavilySearchResult, TavilyResearchResult } from '../types';

const TAVILY_API_URL = 'https://api.tavily.com';

interface TavilySearchResponse {
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  images?: string[];
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }>;
}

interface TavilyExtractResponse {
  results: Array<{
    url: string;
    raw_content: string;
  }>;
  failed_results?: Array<{
    url: string;
    error: string;
  }>;
}

export async function search(
  query: string,
  options: {
    searchDepth?: 'basic' | 'advanced';
    maxResults?: number;
    includeAnswer?: boolean;
    includeImages?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<{
  results: TavilySearchResult[];
  answer?: string;
  followUpQuestions?: string[];
}> {
  const response = await fetch(`${TAVILY_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.tavily.apiKey,
      query,
      search_depth: options.searchDepth ?? 'basic',
      max_results: options.maxResults ?? 10,
      include_answer: options.includeAnswer ?? true,
      include_images: options.includeImages ?? false,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily search failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as TavilySearchResponse;

  return {
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    answer: data.answer,
    followUpQuestions: data.follow_up_questions,
  };
}

export async function advancedSearch(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<{
  results: TavilySearchResult[];
  answer?: string;
  followUpQuestions?: string[];
}> {
  return search(query, {
    ...options,
    searchDepth: 'advanced',
    includeAnswer: true,
  });
}

export async function extract(urls: string[]): Promise<{
  results: Array<{
    url: string;
    content: string;
  }>;
  failed: Array<{
    url: string;
    error: string;
  }>;
}> {
  const response = await fetch(`${TAVILY_API_URL}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.tavily.apiKey,
      urls,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily extract failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as TavilyExtractResponse;

  return {
    results: data.results.map((r) => ({
      url: r.url,
      content: r.raw_content,
    })),
    failed: data.failed_results ?? [],
  };
}

export async function research(
  topic: string,
  queries: string[],
  options: {
    maxResultsPerQuery?: number;
  } = {}
): Promise<TavilyResearchResult[]> {
  const results: TavilyResearchResult[] = [];

  for (const query of queries) {
    try {
      const searchResult = await advancedSearch(query, {
        maxResults: options.maxResultsPerQuery ?? 5,
      });

      results.push({
        query,
        results: searchResult.results,
        summary: searchResult.answer,
      });
    } catch (error) {
      console.error(`Research query failed: ${query}`, error);
      results.push({
        query,
        results: [],
        summary: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return results;
}

export async function marketResearch(
  businessIdea: string
): Promise<{
  competitors: TavilyResearchResult;
  marketSize: TavilyResearchResult;
  trends: TavilyResearchResult;
  targetAudience: TavilyResearchResult;
}> {
  const [competitors, marketSize, trends, targetAudience] = await Promise.all([
    advancedSearch(`${businessIdea} competitors analysis`, { maxResults: 10 }),
    advancedSearch(`${businessIdea} market size revenue industry`, { maxResults: 5 }),
    advancedSearch(`${businessIdea} industry trends 2024 2025`, { maxResults: 5 }),
    advancedSearch(`${businessIdea} target audience demographics`, { maxResults: 5 }),
  ]);

  return {
    competitors: {
      query: `${businessIdea} competitors`,
      results: competitors.results,
      summary: competitors.answer,
    },
    marketSize: {
      query: `${businessIdea} market size`,
      results: marketSize.results,
      summary: marketSize.answer,
    },
    trends: {
      query: `${businessIdea} trends`,
      results: trends.results,
      summary: trends.answer,
    },
    targetAudience: {
      query: `${businessIdea} target audience`,
      results: targetAudience.results,
      summary: targetAudience.answer,
    },
  };
}

export async function competitorAnalysis(
  competitors: string[]
): Promise<Array<{
  name: string;
  results: TavilySearchResult[];
  summary?: string;
}>> {
  const analyses = await Promise.all(
    competitors.map(async (competitor) => {
      const result = await advancedSearch(
        `${competitor} company analysis business model pricing features`,
        { maxResults: 5 }
      );

      return {
        name: competitor,
        results: result.results,
        summary: result.answer,
      };
    })
  );

  return analyses;
}

export async function domainResearch(
  keyword: string
): Promise<{
  brandability: TavilySearchResult[];
  seoValue: TavilySearchResult[];
  similar: TavilySearchResult[];
}> {
  const [brandability, seoValue, similar] = await Promise.all([
    search(`${keyword} brand name ideas`, { maxResults: 5 }),
    search(`${keyword} SEO keyword value search volume`, { maxResults: 5 }),
    search(`${keyword} similar websites businesses`, { maxResults: 5 }),
  ]);

  return {
    brandability: brandability.results,
    seoValue: seoValue.results,
    similar: similar.results,
  };
}
