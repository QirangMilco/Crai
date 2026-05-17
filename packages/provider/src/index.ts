/**
 * Crai provider 包统一出口。
 * 管理所有 LLM provider 实现，每个 provider 以子模块形式组织。
 * 共享核心（SSE 解析等）在 core/ 中复用。
 */
export { createOpenAIProvider } from './openai/index'
export type { OpenAIProviderOptions } from './openai/index'
export { OpenAIAdapter } from './openai/adapter'
export type { OpenAIAdapterOptions } from './openai/adapter'

export { createDeepSeekProvider } from './deepseek/index'
export type { DeepSeekProviderOptions } from './deepseek/index'
export { DeepSeekAdapter } from './deepseek/adapter'
export type { DeepSeekAdapterOptions } from './deepseek/adapter'

export { createMockProvider } from './mock/index'

export { sseLines } from './core/stream'

export { setDebugScopes, isDebugScope, DEBUG_SCOPES } from './core/debug'

/**
 * 通用模型列表获取。
 * 大部分 OpenAI 兼容提供商在 {baseURL}/models 返回标准格式。
 * 少数接口不同的提供商可通过 provider config 的 modelsPath 指定。
 */
export async function listModels(apiKey: string, baseURL?: string, modelsPath?: string): Promise<{ models: string[]; error?: string }> {
  const base = (baseURL || '').replace(/\/+$/, '')
  if (!base) return { models: [], error: '未设置 Base URL' }
  const url = `${base}${modelsPath || '/models'}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { models: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const body = (await res.json()) as { data?: Array<{ id: string }> }
    const models = (body.data ?? []).map((m: { id: string }) => m.id).sort()
    return { models, error: models.length === 0 ? 'API 返回了空列表' : undefined }
  } catch (err: any) {
    return { models: [], error: err?.message ?? String(err) }
  }
}
