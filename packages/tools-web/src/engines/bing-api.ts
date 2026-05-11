import type { SearchEngine, SearchResult } from './types'

/**
 * Bing Web Search API 引擎。需要 Azure 订阅 key。
 *
 * 使用方式：createWebTools({ searchEngine: 'bing', apiKey: 'your-bing-api-key' })
 *
 * API 文档：
 * https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/endpoints
 */
export class BingApiEngine implements SearchEngine {
  readonly id = 'bing'
  readonly name = 'Bing API'
  readonly needsApiKey = true
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${Math.min(maxResults, 50)}`
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw new Error(`Bing 搜索失败: HTTP ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      webPages?: {
        value: Array<{
          name: string
          url: string
          snippet: string
        }>
      }
    }

    const pages = data.webPages?.value ?? []
    return pages.slice(0, maxResults).map((page) => ({
      title: page.name,
      url: page.url,
      snippet: page.snippet,
    }))
  }
}
