/** 搜索引擎接口。每个引擎实现一个搜索方法。 */
export interface SearchEngine {
  readonly id: string
  readonly name: string
  /** 是否需要 API key。true 时 createWebTools 需传入 apiKey。 */
  readonly needsApiKey: boolean
  search(query: string, maxResults: number): Promise<SearchResult[]>
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}
