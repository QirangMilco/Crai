/**
 * 前端共享工具函数。
 *
 * 后端数据查询函数（getModelContextWindow 等）集中在此，
 * 避免在多个组件中复制。后端是唯一数据源，前端只处理查询和显示。
 */

/** 跨所有 provider 搜索模型上下文窗口。 */
export function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow?: number; maxOutput?: number }>>): number | undefined {
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.contextWindow
  if (byProvider) return byProvider
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.contextWindow) return models[model].contextWindow
    }
  }
  return undefined
}

/** 跨所有 provider 搜索模型显示名。 */
export function getKnownModelDisplayName(provider: string, model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number }>>): string | undefined {
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.displayName
  if (byProvider) return byProvider
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.displayName) return models[model].displayName
    }
  }
  return undefined
}

/** 跨所有 provider 查找已知模型信息。 */
export function findModelInfoAcrossProviders(model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number }>>): { displayName?: string; contextWindow?: number; maxOutput?: number } | undefined {
  if (!knownModels) return undefined
  for (const models of Object.values(knownModels)) {
    if (models[model]) return models[model]
  }
  return undefined
}

/** Token 数格式化为人类可读形式（1K = 1024）。 */
export function formatCtx(tokens: number): string {
  const K = 1024
  const M = K * K
  if (tokens >= M && tokens % M === 0) return `${tokens / M}M`
  if (tokens >= K && tokens % K === 0) return `${tokens / K}K`
  if (tokens >= M) return `${(tokens / M).toFixed(2).replace(/\.?0+$/, '')}M`
  if (tokens >= K) return `${(tokens / K).toFixed(1).replace(/\.?0+$/, '')}K`
  return String(tokens)
}

/** Token 数以千位分隔格式显示。 */
export function formatCtxExact(tokens: number): string {
  return tokens.toLocaleString('en-US')
}
