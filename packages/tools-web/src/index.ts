import type { Extension } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import type { SearchEngine } from './engines/types'
import { DuckDuckGoEngine } from './engines/duckduckgo'
import { BingApiEngine } from './engines/bing-api'

// ── 配置 ─────────────────────────────────────────────

export interface WebToolsOptions {
  /** 搜索引擎 id（默认 'duckduckgo'）。 */
  searchEngine?: string
  /** 搜索引擎所需的 API key（如 Bing API key）。 */
  apiKey?: string
  /** 最大返回结果数（默认 5）。 */
  maxResults?: number
}

// ── Extension 工厂 ──────────────────────────────────

export function createWebTools(options?: WebToolsOptions): Extension {
  const maxResults = options?.maxResults ?? 5

  // 选择搜索引擎
  const searchEngine = resolveEngine(options)

  return {
    name: 'tools-web',
    setup(ctx) {
      // ── web_search ──
      ctx.registerTool({
        name: 'web_search',
        description: '搜索互联网，返回相关结果列表（标题 + URL + 摘要）。',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
          },
          required: ['query'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.SAFE as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const query = String(args.query ?? '')

            if (!query) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'web_search',
                isError: true,
                content: [{ type: 'text', text: '查询词不能为空' }],
              }
            }

            const results = await searchEngine.search(query, maxResults)

            if (results.length === 0) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'web_search',
                content: [{ type: 'text', text: '(无搜索结果)' }],
              }
            }

            const formatted = results
              .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
              .join('\n\n')

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'web_search',
              content: [{ type: 'text', text: formatted }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'web_search',
              isError: true,
              content: [{ type: 'text', text: `搜索失败: ${err.message}` }],
            }
          }
        },
      })

      // ── web_fetch ──
      ctx.registerTool({
        name: 'web_fetch',
        description: '获取 URL 内容并返回文本。适用于读取文档、文章、API 响应等。',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '完整的 URL（含 https://）' },
            maxLength: {
              type: 'number',
              description: '最多返回的字符数（默认 12000）',
              default: 12000,
            },
          },
          required: ['url'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.SAFE as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const url = String(args.url ?? '')
            const maxLength = args.maxLength ? Number(args.maxLength) : 12_000

            if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'web_fetch',
                isError: true,
                content: [{ type: 'text', text: 'URL 必须以 http:// 或 https:// 开头' }],
              }
            }

            const response = await fetch(url, {
              headers: { 'User-Agent': 'Crai/0.1 (AI Agent)' },
              signal: AbortSignal.timeout(15_000),
              redirect: 'follow',
            })

            if (!response.ok) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'web_fetch',
                isError: true,
                content: [{ type: 'text', text: `请求失败: HTTP ${response.status} ${response.statusText}` }],
              }
            }

            const text = await response.text()
            const plain = text
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/')
              .replace(/\s+/g, ' ')
              .trim()

            const truncated = plain.length > maxLength
              ? plain.slice(0, maxLength) + '\n...(内容已截断)'
              : plain

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'web_fetch',
              content: [{ type: 'text', text: truncated || '(无内容)' }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'web_fetch',
              isError: true,
              content: [{ type: 'text', text: `获取失败: ${err.message}` }],
            }
          }
        },
      })
    },
  }
}

// ── 引擎选择 ────────────────────────────────────────

function resolveEngine(options?: WebToolsOptions): SearchEngine {
  const engineId = options?.searchEngine ?? 'duckduckgo'
  const apiKey = options?.apiKey

  if (engineId === 'bing' || engineId === 'bing-api') {
    if (!apiKey) {
      console.warn('[tools-web] Bing API 需要 apiKey，回退到 DuckDuckGo')
      return new DuckDuckGoEngine()
    }
    return new BingApiEngine(apiKey)
  }

  return new DuckDuckGoEngine()
}
