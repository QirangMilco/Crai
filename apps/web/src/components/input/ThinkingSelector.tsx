/**
 * ThinkingSelector — thinking level 选择器。
 *
 * 根据当前模型的 provider 动态展示可用的 thinking level 选项。
 * 若传入的 thinkingLevel 对当前 provider 无效，自动 fallback 并同步到外部。
 */
import { useEffect } from 'react'
import { Select } from '../ui/Select'

export const THINKING_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'off', label: '关' },
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最高' },
  { value: 'xhigh', label: '极高' },
]

export const PROVIDER_THINKING_LEVELS: Record<string, string[]> = {
  deepseek:  ['off', 'high', 'max'],
  openai:    ['off', 'low', 'medium', 'high'],
  anthropic: ['off', 'high', 'xhigh'],
  mock:      ['off', 'auto', 'low', 'medium', 'high', 'xhigh'],
}

const ALL_THINKING_LEVEL_VALUES = THINKING_LEVELS.map((tl) => tl.value)

export function getAvailableThinkingLevels(
  provider: string,
  configLevels?: Record<string, string>,
): Array<{ value: string; label: string }> {
  if (configLevels) {
    return Object.entries(configLevels).map(([value, label]) => ({ value, label }))
  }
  const levels = PROVIDER_THINKING_LEVELS[provider] ?? ALL_THINKING_LEVEL_VALUES
  return THINKING_LEVELS.filter((tl) => levels.includes(tl.value))
}

interface ThinkingSelectorProps {
  currentModel?: string
  models?: Array<{ name: string; provider: string }>
  thinkingLevel?: string
  onThinkingLevelChange?: (level: string) => void
  providerThinkingLevels?: Record<string, string>
  defaultThinkingLevels?: Record<string, string>
}

export function ThinkingSelector({
  currentModel,
  models,
  thinkingLevel,
  onThinkingLevelChange,
  providerThinkingLevels,
  defaultThinkingLevels,
}: ThinkingSelectorProps) {
  const curProvider = models?.find((m) => m.name === currentModel)?.provider ?? ''
  const availableLevels = getAvailableThinkingLevels(curProvider, providerThinkingLevels)
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
