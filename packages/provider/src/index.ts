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

export { sseLines } from './core/stream'

/**
 * 通用模型列表获取。
 * 大部分 OpenAI 兼容提供商在 {baseURL}/models 返回标准格式。
 * 少数接口不同的提供商可通过 provider config 的 modelsPath 指定。
 */
export async function listModels(apiKey: string, baseURL?: string, modelsPath?: string): Promise<string[]> {
  const base = (baseURL || '').replace(/\/+$/, '')
  if (!base) return []
  const url = `${base}${modelsPath || '/models'}?${Date.now()}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: Array<{ id: string }> }
    return (body.data ?? []).map((m: { id: string }) => m.id).sort()
  } catch {
    return []
  }
}
