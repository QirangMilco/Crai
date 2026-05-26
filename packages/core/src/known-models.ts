/**
 * @crai/core — 已知模型注册表
 *
 * 记录已知模型的上下文窗口、最大输出 token 等能力信息。
 * 纯数据，零依赖。适配器用此设置适当的 max_tokens，
 * context-window 模块用此计算压缩阈值。
 *
 * 参考 OpenHanako 的 known-models.json（完整覆盖）设计。
 *
 * 模型列表来源：
 * - OpenHanako known-models.json（主要来源）
 * - Snow-CLI models/types
 * - 各 provider 官方文档
 */

export interface ModelInfo {
  /** 显示名称（如 "DeepSeek V4 Flash"）。未设置时回退使用模型 ID。 */
  displayName?: string
  /** 总上下文窗口（token）。 */
  contextWindow: number
  /** 最大输出 token（可选，默认取窗口的 1/4）。 */
  maxOutput?: number
  /** 是否支持 thinking mode。 */
  thinking?: boolean
  /**
   * 支持的思考深度列表。
   * 未设置时使用 provider 默认值；provider 也未设置时使用全局默认（全部级别）。
   * 适配器收到外部 thinkingLevel 后自行转换为 provider 内部参数。
   */
  supportedThinkingLevels?: string[]
}

/**
 * 各 provider 默认支持的思考深度列表。
 * 模型未定义 supportedThinkingLevels 时继承 provider 默认值。
 */
export const PROVIDER_DEFAULT_THINKING_LEVELS: Record<string, string[]> = {
  'deepseek': ['off', 'high', 'max'],
  'openai':   ['off', 'low', 'medium', 'high'],
  'anthropic': ['off', 'high', 'xhigh'],
  'mock':     ['off', 'auto', 'low', 'medium', 'high', 'xhigh'],
}

/** Provider → model name → info */
export type KnownModelsMap = Record<string, Record<string, ModelInfo>>

// ════════════════════════════════════════════════════════════════
// DeepSeek
// ════════════════════════════════════════════════════════════════

const DEEPSEEK_MODELS: Record<string, ModelInfo> = {
  'deepseek-v4-flash': { displayName: 'DeepSeek V4 Flash', contextWindow: 1048576, thinking: true },
  'deepseek-v4-pro':   { displayName: 'DeepSeek V4 Pro', contextWindow: 1048576, thinking: true },
  'deepseek-v3':       { displayName: 'DeepSeek V3', contextWindow: 1048576, thinking: true },
  'deepseek-reasoner': { displayName: 'DeepSeek Reasoner', contextWindow: 65536, thinking: true },
  'deepseek-chat':     { displayName: 'DeepSeek Chat', contextWindow: 32768, supportedThinkingLevels: ['off'] },
  'deepseek-coder':    { displayName: 'DeepSeek Coder', contextWindow: 16384, supportedThinkingLevels: ['off'] },
}

// ════════════════════════════════════════════════════════════════
// OpenAI
// ════════════════════════════════════════════════════════════════

const OPENAI_MODELS: Record<string, ModelInfo> = {
  'gpt-4o':           { displayName: 'GPT-4o', contextWindow: 131072, maxOutput: 16384 },
  'gpt-4o-2024-08-06': { displayName: 'GPT-4o (2024-08-06)', contextWindow: 131072, maxOutput: 16384 },
  'gpt-4o-mini':       { displayName: 'GPT-4o Mini', contextWindow: 131072, maxOutput: 16384 },
  'gpt-4-turbo':       { displayName: 'GPT-4 Turbo', contextWindow: 131072, maxOutput: 4096 },
  'gpt-4':             { displayName: 'GPT-4', contextWindow: 8192,   maxOutput: 4096 },
  'gpt-4-32k':         { displayName: 'GPT-4 32K', contextWindow: 32768,  maxOutput: 4096 },
  'gpt-3.5-turbo':     { displayName: 'GPT-3.5 Turbo', contextWindow: 16384,  maxOutput: 4096 },
  'gpt-3.5-turbo-16k': { displayName: 'GPT-3.5 Turbo 16K', contextWindow: 16384,  maxOutput: 4096 },

  // o 系列
  'o1':         { displayName: 'o1', contextWindow: 204800, maxOutput: 102400 },
  'o1-mini':    { displayName: 'o1 Mini', contextWindow: 131072, maxOutput: 65536 },
  'o1-preview': { displayName: 'o1 Preview', contextWindow: 131072, maxOutput: 32768 },
  'o3-mini':    { displayName: 'o3 Mini', contextWindow: 204800, maxOutput: 102400 },
}

// ════════════════════════════════════════════════════════════════
// Anthropic (Claude)
// ════════════════════════════════════════════════════════════════

const ANTHROPIC_MODELS: Record<string, ModelInfo> = {
  'claude-3-5-sonnet-20241022': { displayName: 'Claude 3.5 Sonnet', contextWindow: 204800, maxOutput: 8192 },
  'claude-3-5-haiku-20241022':  { displayName: 'Claude 3.5 Haiku', contextWindow: 204800, maxOutput: 8192 },
  'claude-3-opus-20240229':     { displayName: 'Claude 3 Opus', contextWindow: 204800, maxOutput: 4096 },
  'claude-3-sonnet-20240229':   { displayName: 'Claude 3 Sonnet', contextWindow: 204800, maxOutput: 4096 },
  'claude-3-haiku-20240307':    { displayName: 'Claude 3 Haiku', contextWindow: 204800, maxOutput: 4096 },
  'claude-4-opus':              { displayName: 'Claude 4 Opus', contextWindow: 204800, maxOutput: 8192, thinking: true },
  'claude-4-sonnet':            { displayName: 'Claude 4 Sonnet', contextWindow: 204800, maxOutput: 8192, thinking: true },
}

// ════════════════════════════════════════════════════════════════
// Google (Gemini)
// ════════════════════════════════════════════════════════════════

const GEMINI_MODELS: Record<string, ModelInfo> = {
  'gemini-2.0-flash':     { displayName: 'Gemini 2.0 Flash', contextWindow: 1048576, maxOutput: 8192 },
  'gemini-2.0-flash-lite': { displayName: 'Gemini 2.0 Flash Lite', contextWindow: 1048576, maxOutput: 8192 },
  'gemini-1.5-pro':       { displayName: 'Gemini 1.5 Pro', contextWindow: 2097152, maxOutput: 8192 },
  'gemini-1.5-flash':     { displayName: 'Gemini 1.5 Flash', contextWindow: 1048576, maxOutput: 8192 },
  'gemini-1.5-flash-8b':  { displayName: 'Gemini 1.5 Flash 8B', contextWindow: 1048576, maxOutput: 8192 },
}

// ════════════════════════════════════════════════════════════════
// Meta (Llama)
// ════════════════════════════════════════════════════════════════

const LLAMA_MODELS: Record<string, ModelInfo> = {
  'llama-3.1-405b':  { displayName: 'Llama 3.1 405B', contextWindow: 131072 },
  'llama-3.1-70b':   { displayName: 'Llama 3.1 70B', contextWindow: 131072 },
  'llama-3.1-8b':    { displayName: 'Llama 3.1 8B', contextWindow: 131072 },
  'llama-3-70b':     { displayName: 'Llama 3 70B', contextWindow: 8192 },
  'llama-3-8b':      { displayName: 'Llama 3 8B', contextWindow: 8192 },
}

// ════════════════════════════════════════════════════════════════
// Mistral
// ════════════════════════════════════════════════════════════════

const MISTRAL_MODELS: Record<string, ModelInfo> = {
  'mistral-large':       { displayName: 'Mistral Large', contextWindow: 131072 },
  'mistral-medium':      { displayName: 'Mistral Medium', contextWindow: 32768 },
  'mistral-small':       { displayName: 'Mistral Small', contextWindow: 32768 },
  'codestral':           { displayName: 'Codestral', contextWindow: 262144 },
  'ministral-8b':        { displayName: 'Ministral 8B', contextWindow: 131072 },
}

// ════════════════════════════════════════════════════════════════
// 汇总
// ════════════════════════════════════════════════════════════════

export const KNOWN_MODELS: KnownModelsMap = {
  deepseek:   DEEPSEEK_MODELS,
  openai:     OPENAI_MODELS,
  anthropic:  ANTHROPIC_MODELS,
  gemini:     GEMINI_MODELS,
  google:     GEMINI_MODELS,    // 别名
  llama:      LLAMA_MODELS,
  meta:       LLAMA_MODELS,     // 别名
  mistral:    MISTRAL_MODELS,
  mock: {
    'mock': { displayName: 'Mock Model', contextWindow: 65536, thinking: true },
  },
}

/** 默认上下文窗口（模型未知时使用）。 */
export const DEFAULT_CONTEXT_WINDOW = 65536

/** 默认上下文预留比例（用户消息 + 系统提示需要的额外空间）。 */
export const CONTEXT_RESERVE_RATIO = 0.9

/** 默认压缩阈值：超过上下文窗口的此比例时触发压缩。 */
export const DEFAULT_COMPRESSION_THRESHOLD = 0.8

/** 默认保留最近 token 数（压缩后保留的最新消息 token 量）。 */
export const DEFAULT_KEEP_RECENT_TOKENS = 32000

/**
 * 查询已知模型信息。
 *
 * 查找顺序：
 * 1. provider+model 精确匹配
 * 2. provider 内 model 名模糊匹配（model 包含 key 或 key 包含 model）
 * 3. 跨 provider 模糊匹配
 * 4. 返回 undefined（调用方使用默认值）
 */
export function getModelInfo(provider: string, model: string, customWindows?: Record<string, number>): ModelInfo | undefined {
  // 自定义上下文窗口优先级最高：先按 provider:model 查，再按裸名查
  if (customWindows) {
    const compositeKey = `${provider}:${model}`
    if (customWindows[compositeKey] !== undefined) return { contextWindow: customWindows[compositeKey] }
    if (customWindows[model] !== undefined) return { contextWindow: customWindows[model] }
  }

  const byProvider = KNOWN_MODELS[provider.toLowerCase()]
  if (byProvider) {
    const exact = byProvider[model]
    if (exact) return exact
    // 模糊匹配
    for (const [key, info] of Object.entries(byProvider)) {
      if (model.includes(key) || key.includes(model)) return info
    }
  }
  // 跨 provider 模糊匹配
  for (const models of Object.values(KNOWN_MODELS)) {
    for (const [key, info] of Object.entries(models)) {
      if (model.includes(key) || key.includes(model)) return info
    }
  }
  return undefined
}

/**
 * 获取模型上下文窗口。未知模型返回 DEFAULT_CONTEXT_WINDOW。
 */
export function getContextWindow(
  provider: string,
  model: string,
  customWindows?: Record<string, number>,
): number {
  return getModelInfo(provider, model, customWindows)?.contextWindow ?? DEFAULT_CONTEXT_WINDOW
}

/**
 * 获取模型最大输出 token。未知模型使用默认值。
 */
export function getMaxOutput(provider: string, model: string): number {
  const info = getModelInfo(provider, model)
  if (info?.maxOutput) return info.maxOutput
  return Math.max(4096, Math.floor(getContextWindow(provider, model) / 4))
}

/**
 * 获取所有已知的 provider 名称列表。
 */
export function getKnownProviders(): string[] {
  return Object.keys(KNOWN_MODELS)
}

/**
 * 获取指定 provider 下的所有已知模型名。
 */
export function getKnownModels(provider: string): string[] {
  const byProvider = KNOWN_MODELS[provider.toLowerCase()]
  return byProvider ? Object.keys(byProvider) : []
}

/**
 * 获取模型支持的思考深度列表。
 * 优先级：模型级定义 > provider 默认值 > 全部级别。
 */
export function getSupportedThinkingLevels(provider: string, model: string): string[] {
  const info = getModelInfo(provider, model)
  if (info?.supportedThinkingLevels) return info.supportedThinkingLevels
  const providerDefault = PROVIDER_DEFAULT_THINKING_LEVELS[provider.toLowerCase()]
  if (providerDefault) return providerDefault
  return ['off', 'auto', 'low', 'medium', 'high', 'xhigh', 'max']
}
