import type { SearchEngine, SearchResult } from './types'

/** DuckDuckGo Lite 搜索引擎。免费，无需 API key。 */
export class DuckDuckGoEngine implements SearchEngine {
  readonly id = 'duckduckgo'
  readonly name = 'DuckDuckGo'
  readonly needsApiKey = false

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Crai/0.1 (AI Agent)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw new Error(`DuckDuckGo 搜索失败: HTTP ${response.status}`)
    }

    const html = await response.text()
    return parseDuckDuckGoLiteResults(html, maxResults)
  }
}

function parseDuckDuckGoLiteResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []

  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi

  const links: Array<{ url: string; title: string }> = []
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    links.push({
      url: match[1].trim(),
      title: match[2].replace(/<[^>]+>/g, '').trim(),
    })
  }

  const snippets: string[] = []
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i]?.title ?? '',
      url: links[i]?.url ?? '',
      snippet: snippets[i] ?? '',
    })
  }

  return results
}
