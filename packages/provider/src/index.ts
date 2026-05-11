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
