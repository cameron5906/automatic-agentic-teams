import type { ToolResult } from '../../types';
import * as tavily from '../../services/tavily';
import * as projectStore from '../../context/project-store';

export async function search(
  query: string,
  options: {
    maxResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<ToolResult> {
  try {
    const result = await tavily.search(query, {
      maxResults: options.maxResults ?? 10,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      includeAnswer: true,
    });

    return {
      success: true,
      data: {
        query,
        answer: result.answer,
        resultCount: result.results.length,
        results: result.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content.substring(0, 300) + (r.content.length > 300 ? '...' : ''),
          score: r.score,
        })),
        followUpQuestions: result.followUpQuestions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

export async function research(
  topic: string,
  queries: string[],
  options: {
    maxResultsPerQuery?: number;
    projectId?: string;
  } = {}
): Promise<ToolResult> {
  try {
    const results = await tavily.research(topic, queries, {
      maxResultsPerQuery: options.maxResultsPerQuery ?? 5,
    });

    const summaries = results
      .filter((r) => r.summary)
      .map((r) => `**${r.query}**: ${r.summary}`)
      .join('\n\n');

    if (options.projectId) {
      projectStore.addResearch(options.projectId, summaries);
    }

    return {
      success: true,
      data: {
        topic,
        queriesRun: queries.length,
        results: results.map((r) => ({
          query: r.query,
          summary: r.summary,
          sourceCount: r.results.length,
          topSources: r.results.slice(0, 3).map((s) => ({
            title: s.title,
            url: s.url,
          })),
        })),
        combinedSummary: summaries,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Research failed',
    };
  }
}

export async function marketResearch(
  businessIdea: string,
  projectId?: string
): Promise<ToolResult> {
  try {
    const result = await tavily.marketResearch(businessIdea);

    const fullReport = `
## Market Research: ${businessIdea}

### Competitors
${result.competitors.summary || 'No summary available'}

### Market Size
${result.marketSize.summary || 'No summary available'}

### Industry Trends
${result.trends.summary || 'No summary available'}

### Target Audience
${result.targetAudience.summary || 'No summary available'}
`.trim();

    if (projectId) {
      projectStore.addResearch(projectId, fullReport);
    }

    return {
      success: true,
      data: {
        businessIdea,
        competitors: {
          summary: result.competitors.summary,
          sources: result.competitors.results.slice(0, 5).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        },
        marketSize: {
          summary: result.marketSize.summary,
          sources: result.marketSize.results.slice(0, 3).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        },
        trends: {
          summary: result.trends.summary,
          sources: result.trends.results.slice(0, 3).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        },
        targetAudience: {
          summary: result.targetAudience.summary,
          sources: result.targetAudience.results.slice(0, 3).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        },
        fullReport,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Market research failed',
    };
  }
}

export async function competitorAnalysis(
  competitors: string[]
): Promise<ToolResult> {
  try {
    const analyses = await tavily.competitorAnalysis(competitors);

    return {
      success: true,
      data: {
        competitorCount: competitors.length,
        analyses: analyses.map((a) => ({
          name: a.name,
          summary: a.summary,
          topSources: a.results.slice(0, 3).map((r) => ({
            title: r.title,
            url: r.url,
          })),
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Competitor analysis failed',
    };
  }
}

export async function extract(urls: string[]): Promise<ToolResult> {
  try {
    const result = await tavily.extract(urls);

    return {
      success: true,
      data: {
        extracted: result.results.map((r) => ({
          url: r.url,
          contentLength: r.content.length,
          preview: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
        })),
        failed: result.failed,
        summary: `Extracted content from ${result.results.length}/${urls.length} URLs`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Content extraction failed',
    };
  }
}

export async function domainResearch(keyword: string): Promise<ToolResult> {
  try {
    const result = await tavily.domainResearch(keyword);

    return {
      success: true,
      data: {
        keyword,
        brandability: {
          suggestions: result.brandability.map((r) => ({
            title: r.title,
            url: r.url,
          })),
        },
        seoValue: {
          insights: result.seoValue.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content.substring(0, 200),
          })),
        },
        similarBusinesses: result.similar.map((r) => ({
          title: r.title,
          url: r.url,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Domain research failed',
    };
  }
}
