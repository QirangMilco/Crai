/**
 * 右侧配置编辑区。
 * 处理三种状态：未选择（placeholder）、添加自定义供应商、编辑已有供应商。
 */

import { ui } from '../ConfigPanel.strings'

interface ProviderEntry {
  name: string
  label: string
  configured: boolean
  isPreset: boolean
  apiKey: string
  baseURL: string
  models: string[]
}

interface Props {
  editing: string | null
  entry?: ProviderEntry

  // 编辑已有供应商
  editKey: string
  editBaseURL: string
  editModelsPath: string
  onKeyChange: (val: string) => void
  onBaseURLChange: (val: string) => void
  onPathChange: (val: string) => void
  onBlur?: () => void
  onTest?: () => void
  testButtonState: 'idle' | 'testing' | 'ok' | 'fail'
  isPreset: boolean
  firstPartyDefaultBaseURL?: string
  onDelete?: () => void

  // 添加自定义供应商
  customName: string
  customKey: string
  customBaseURL: string
  customModelsPath: string
  customApi: string
  onCustomNameChange: (val: string) => void
  onCustomKeyChange: (val: string) => void
  onCustomBaseURLChange: (val: string) => void
  onCustomModelsPathChange: (val: string) => void
  onCustomApiChange: (val: string) => void
  onAddCustom: () => void

  // 编辑（仅自定义 provider）
  editApi: string
  onApiChange: (val: string) => void

  ui: Record<string, string>
}

export function ProviderEditor({
  editing, entry,
  editKey, editBaseURL, editModelsPath,
  onKeyChange, onBaseURLChange, onPathChange,
  onBlur, onTest, testButtonState, isPreset, firstPartyDefaultBaseURL, onDelete,
  customName, customKey, customBaseURL, customModelsPath, customApi,
  onCustomNameChange, onCustomKeyChange, onCustomBaseURLChange, onCustomModelsPathChange, onCustomApiChange,
  onAddCustom,
  editApi, onApiChange,
  ui: _ui,
}: Props) {
  // 未选择
  if (!editing) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--crai-fg-40)', opacity: 0.35 }}>
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <div className="text-xs" style={{ color: 'var(--crai-fg-40)' }}>{ui.selectProviderHint}</div>
      </div>
    )
  }

  // 添加自定义供应商
  if (editing === '__new__') {
    return (
      <div className="max-w-md space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-4">{ui.addCustomTitle}</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium opacity-60">{ui.nameLabel}</label>
              <input
                value={customName}
                onChange={e => onCustomNameChange(e.target.value)}
                placeholder={ui.namePlaceholder}
                className="w-full px-3 py-2 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium opacity-60">API Key</label>
              <input
                value={customKey}
                onChange={e => onCustomKeyChange(e.target.value)}
                placeholder="sk-..." type="password"
                className="w-full px-3 py-2 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium opacity-60">Base URL</label>
              <input
                value={customBaseURL}
                onChange={e => onCustomBaseURLChange(e.target.value)}
                placeholder="https://api.xxx.com/v1"
                className="w-full px-3 py-2 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium opacity-60">{ui.modelsApiPathLabel}</label>
              <input
                value={customModelsPath}
                onChange={e => onCustomModelsPathChange(e.target.value)}
                placeholder={`${ui.defaultOption || '默认'} /v1/models`}
                className="w-full px-3 py-2 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium opacity-60">API 格式</label>
              <select
                value={customApi}
                onChange={e => onCustomApiChange(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              >
                <option value="">自动（按名称匹配）</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <button
              onClick={onAddCustom}
              disabled={!customName || !customKey}
              className="w-full py-2.5 rounded text-xs font-medium text-white disabled:opacity-40 mt-2"
              style={{ backgroundColor: 'var(--crai-accent)' }}
            >
              {ui.addProviderBtn}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 编辑已有供应商
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {entry?.label || editing}{ui.editProviderTitle}
        </h3>
        {!isPreset && onDelete && (
          <button
            onClick={onDelete}
            className="text-[10px] px-2 py-1 rounded border transition-colors"
            style={{ color: 'var(--crai-destructive)', borderColor: 'var(--crai-destructive)' }}
          >
            {ui.deleteProvider}
          </button>
        )}
      </div>

      {/* API Key 行 */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">API Key</span>
        <div className="flex-1 flex items-center gap-1.5">
          <input
            value={editKey}
            onChange={e => onKeyChange(e.target.value)}
            onBlur={onBlur}
            type="password" placeholder="sk-..."
            autoComplete="new-password"
            spellCheck={false}
            className="flex-1 px-3 py-2 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
          />
          {onTest && (
            <button
              onClick={onTest}
              className="w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
              style={{
                color: testButtonState === 'ok' ? 'var(--crai-success)' : testButtonState === 'fail' ? 'var(--crai-destructive)' : 'var(--crai-fg-tertiary)',
                border: `1px solid ${
                  testButtonState === 'ok' ? 'var(--crai-success)' :
                  testButtonState === 'fail' ? 'var(--crai-destructive)' :
                  testButtonState === 'testing' ? 'var(--crai-accent)' :
                  'var(--crai-border)'
                }`,
              }}
              title={
                testButtonState === 'ok' ? ui.connectionOk :
                testButtonState === 'fail' ? ui.connectionFail :
                testButtonState === 'testing' ? ui.connectionTesting :
                ui.testConnection
              }
            >
              {testButtonState === 'testing' ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              ) : testButtonState === 'ok' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--crai-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : testButtonState === 'fail' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--crai-destructive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Base URL 行 */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">Base URL</span>
        <input
          value={editBaseURL}
          onChange={e => onBaseURLChange(e.target.value)}
          onBlur={onBlur}
          placeholder={firstPartyDefaultBaseURL ? `${ui.baseUrlDefaultHint}${firstPartyDefaultBaseURL}` : 'https://...'}
          className="flex-1 px-3 py-2 rounded text-xs outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
        />
      </div>

      {/* Models API 路径（仅自定义 provider） */}
      {!isPreset && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">{ui.apiPathLabel}</span>
          <input
            value={editModelsPath}
            onChange={e => onPathChange(e.target.value)}
            placeholder="/v1/models"
            className="flex-1 px-3 py-2 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
          />
        </div>
      )}

      {/* API 格式（仅自定义 provider） */}
      {!isPreset && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">API 格式</span>
          <select
            value={editApi}
            onChange={e => onApiChange(e.target.value)}
            className="flex-1 px-3 py-2 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
          >
            <option value="">自动（按名称匹配）</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
      )}
    </div>
  )
}
