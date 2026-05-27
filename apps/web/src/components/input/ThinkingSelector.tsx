/**
 * ThinkingSelector — thinking level 选择器。
 *
 * 根据当前模型的 provider 动态展示可用的 thinking level 选项。
 * 若传入的 thinkingLevel 对当前 provider 无效，自动 fallback 并同步到外部。
 */
import { useEffect } from 'react'
import { Select } from '../ui/Select'
import { PROVIDER_DEFAULT_THINKING_LEVELS } from '@crai/core'

export const THINKING_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'off', label: '关' },
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最高' },
  { value: 'xhigh', label: '极高' },
]

const LABEL_MAP: Record<string, string> = { off: '关', auto: '自动', low: '低', medium: '中', high: '高', max: '最高', xhigh: '极高' }

/** 按提供商标识查找 thinking levels：provider 名 → 硬编码默认值 → ALL */
function getProviderLevels(provider: string): string[] {
  return PROVIDER_DEFAULT_THINKING_LEVELS[provider.toLowerCase()] ?? ['off', 'auto', 'low', 'medium', 'high', 'xhigh', 'max']
}

export function getAvailableThinkingLevels(
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; supportedThinkingLevels?: string[] }>>,
  modelName?: string,
): Array<{ value: string; label: string }> {
  // 1. 模型自身定义的 supportedThinkingLevels（从 knownModels 跨 provider 查找）
  if (knownModels && modelName) {
    for (const models of Object.values(knownModels)) {
      const info = models[modelName]
      if (info?.supportedThinkingLevels) {
        return info.supportedThinkingLevels.map(v => ({ value: v, label: LABEL_MAP[v] ?? v }))
      }
    }
  }
  // 2. 在 knownModels 中找到了模型但没有 supportedThinkingLevels → 用模型所在 provider 的默认值
  if (knownModels && modelName) {
    for (const [provider, models] of Object.entries(knownModels)) {
      if (models[modelName]) {
        const levels = getProviderLevels(provider)
        return THINKING_LEVELS.filter((tl) => levels.includes(tl.value))
      }
    }
  }
  // 3. 完全未知 → 全部级别
  return THINKING_LEVELS
}

interface ThinkingSelectorProps {
  currentModel?: string
  models?: Array<{ name: string; provider: string }>
  thinkingLevel?: string
  onThinkingLevelChange?: (level: string) => void
  defaultThinkingLevels?: Record<string, string>
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; supportedThinkingLevels?: string[] }>>
}

export function ThinkingSelector({
  currentModel,
  models,
  thinkingLevel,
  onThinkingLevelChange,
  defaultThinkingLevels,
  knownModels,
}: ThinkingSelectorProps) {
  const curProvider = (() => {
    if (!currentModel || !models) return ''
    const slashIdx = currentModel.indexOf('/')
    if (slashIdx > 0) return currentModel.slice(0, slashIdx)
    return models.find((m) => m.name === currentModel)?.provider ?? ''
  })()
  const modelName = currentModel ? (currentModel.indexOf('/') > 0 ? currentModel.split('/')[1] : currentModel) : undefined
  const availableLevels = getAvailableThinkingLevels(knownModels, modelName)
  const fallbackLevel = (curProvider && defaultThinkingLevels?.[curProvider]) ?? availableLevels[0]?.value ?? 'off'
  const effectiveLevel = availableLevels.some((l) => l.value === thinkingLevel) ? thinkingLevel : fallbackLevel

  // 若外部传入的 thinkingLevel 对当前 provider 无效，自动同步修正
  useEffect(() => {
    if (effectiveLevel !== thinkingLevel) {
      onThinkingLevelChange?.(effectiveLevel)
    }
  }, [effectiveLevel, thinkingLevel, onThinkingLevelChange])

  return (
    <Select
      value={effectiveLevel}
      onChange={(v) => onThinkingLevelChange?.(v)}
      options={availableLevels}
      placeholder="思考"
      className="shrink-0"
      style={{ backgroundColor: 'transparent', border: 'none', padding: '2px 4px', maxWidth: 70, minHeight: 0, height: 'auto' }}
    />
  )
}
