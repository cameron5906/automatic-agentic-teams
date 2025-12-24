import { getFileContent, listFiles, searchCode } from '../services/github.js';
import { LRUCache } from 'lru-cache';

export interface DocEntry {
  path: string;
  title: string;
  type: 'adr' | 'research' | 'doc' | 'issue-context';
}

export interface DocSearchResult {
  path: string;
  snippet: string;
  type: DocEntry['type'];
}

const DOCS_PATH = 'docs';
const ADR_PATH = 'docs/adr';
const RESEARCH_PATH = 'docs/research';
const ISSUE_CONTEXT_PATH = 'working/issues';

const docIndexCache = new LRUCache<string, DocEntry[]>({
  max: 10,
  ttl: 1000 * 60 * 5,
});

function extractTitleFromMarkdown(content: string, fallbackPath: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  const frontMatterMatch = content.match(/^---[\s\S]*?title:\s*["']?([^"'\n]+)["']?[\s\S]*?---/);
  if (frontMatterMatch) return frontMatterMatch[1].trim();

  const fileName = fallbackPath.split('/').pop() || fallbackPath;
  return fileName.replace('.md', '').replace(/-/g, ' ');
}

function determineDocType(path: string): DocEntry['type'] {
  if (path.startsWith(ADR_PATH) || path.includes('/adr/')) return 'adr';
  if (path.startsWith(RESEARCH_PATH) || path.includes('/research/')) return 'research';
  if (path.startsWith(ISSUE_CONTEXT_PATH) || path.includes('/issues/')) return 'issue-context';
  return 'doc';
}

export async function docs_list_adrs(): Promise<DocEntry[]> {
  const cacheKey = 'adrs';
  const cached = docIndexCache.get(cacheKey);
  if (cached) return cached;

  try {
    const files = await listFiles(ADR_PATH);
    const adrs: DocEntry[] = [];

    for (const filePath of files) {
      if (!filePath.endsWith('.md')) continue;
      if (filePath.endsWith('README.md')) continue;

      adrs.push({
        path: filePath,
        title: extractTitleFromPath(filePath),
        type: 'adr',
      });
    }

    docIndexCache.set(cacheKey, adrs);
    return adrs;
  } catch (error) {
    console.error('[DocsTools] Failed to list ADRs:', error);
    return [];
  }
}

export async function docs_list_research(): Promise<DocEntry[]> {
  const cacheKey = 'research';
  const cached = docIndexCache.get(cacheKey);
  if (cached) return cached;

  try {
    const files = await listFiles(RESEARCH_PATH);
    const research: DocEntry[] = [];

    for (const filePath of files) {
      if (!filePath.endsWith('.md')) continue;
      if (filePath.endsWith('README.md')) continue;

      research.push({
        path: filePath,
        title: extractTitleFromPath(filePath),
        type: 'research',
      });
    }

    docIndexCache.set(cacheKey, research);
    return research;
  } catch (error) {
    console.error('[DocsTools] Failed to list research:', error);
    return [];
  }
}

export async function docs_list_issue_contexts(): Promise<DocEntry[]> {
  const cacheKey = 'issue-contexts';
  const cached = docIndexCache.get(cacheKey);
  if (cached) return cached;

  try {
    const files = await listFiles(ISSUE_CONTEXT_PATH);
    const contexts: DocEntry[] = [];

    for (const filePath of files) {
      if (!filePath.endsWith('.md')) continue;

      contexts.push({
        path: filePath,
        title: extractTitleFromPath(filePath),
        type: 'issue-context',
      });
    }

    docIndexCache.set(cacheKey, contexts);
    return contexts;
  } catch (error) {
    console.error('[DocsTools] Failed to list issue contexts:', error);
    return [];
  }
}

function extractTitleFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  return fileName.replace('.md', '').replace(/-/g, ' ');
}

export async function docs_read(path: string): Promise<{ content: string; type: DocEntry['type'] }> {
  const content = await getFileContent(path);
  return {
    content,
    type: determineDocType(path),
  };
}

export async function docs_get_adr(identifier: string): Promise<string> {
  const adrs = await docs_list_adrs();

  const match = adrs.find(adr => {
    const fileName = adr.path.split('/').pop() || '';
    return fileName.toLowerCase().includes(identifier.toLowerCase()) ||
           adr.title.toLowerCase().includes(identifier.toLowerCase());
  });

  if (!match) {
    const availableTitles = adrs.map(a => a.title).slice(0, 10);
    throw new Error(`ADR not found: ${identifier}. Available: ${availableTitles.join(', ')}${adrs.length > 10 ? '...' : ''}`);
  }

  return await getFileContent(match.path);
}

export async function docs_get_research(identifier: string): Promise<string> {
  const research = await docs_list_research();

  const match = research.find(r => {
    const fileName = r.path.split('/').pop() || '';
    return fileName.toLowerCase().includes(identifier.toLowerCase()) ||
           r.title.toLowerCase().includes(identifier.toLowerCase());
  });

  if (!match) {
    const availableTitles = research.map(r => r.title).slice(0, 10);
    throw new Error(`Research doc not found: ${identifier}. Available: ${availableTitles.join(', ')}${research.length > 10 ? '...' : ''}`);
  }

  return await getFileContent(match.path);
}

export async function docs_get_issue_context(issueNumber: number | string): Promise<string> {
  const contexts = await docs_list_issue_contexts();

  const match = contexts.find(c => {
    const fileName = c.path.split('/').pop() || '';
    return fileName.startsWith(String(issueNumber));
  });

  if (!match) {
    throw new Error(`Issue context not found for issue #${issueNumber}. This issue may not have been processed yet.`);
  }

  return await getFileContent(match.path);
}

export async function docs_search(query: string, docType?: DocEntry['type']): Promise<DocSearchResult[]> {
  let path = DOCS_PATH;
  if (docType === 'adr') path = ADR_PATH;
  else if (docType === 'research') path = RESEARCH_PATH;
  else if (docType === 'issue-context') path = ISSUE_CONTEXT_PATH;

  const results = await searchCode(query, 'md');

  return results
    .filter(r => r.path.startsWith(path) || (docType === undefined && (
      r.path.startsWith(DOCS_PATH) ||
      r.path.startsWith(ISSUE_CONTEXT_PATH)
    )))
    .map(r => ({
      path: r.path,
      snippet: r.textMatches?.[0] || '',
      type: determineDocType(r.path),
    }))
    .slice(0, 10);
}

export async function docs_get_index(): Promise<{
  adrs: number;
  research: number;
  issueContexts: number;
  paths: { adrs: string; research: string; issueContexts: string; docs: string };
}> {
  const [adrs, research, contexts] = await Promise.all([
    docs_list_adrs(),
    docs_list_research(),
    docs_list_issue_contexts(),
  ]);

  return {
    adrs: adrs.length,
    research: research.length,
    issueContexts: contexts.length,
    paths: {
      adrs: ADR_PATH,
      research: RESEARCH_PATH,
      issueContexts: ISSUE_CONTEXT_PATH,
      docs: DOCS_PATH,
    },
  };
}
