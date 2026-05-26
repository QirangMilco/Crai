/**
 * 模型列表 + 添加模型下拉面板。
 * 展示已添加模型，支持获取远程模型、搜索、手动输入添加、编辑、删除。
 */

function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>): number | undefined {
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.contextWindow
  if (byProvider) return byProvider
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.contextWindow) return models[model].contextWindow
    }
  }
  return undefined
}

function getKnownModelDisplayName(provider: string, model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>): string | undefined {
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.displayName
  if (byProvider) return byProvider
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.displayName) return models[model].displayName
    }
  }
  return undefined
}

function formatCtx(tokens: number): string {
  const K = 1024
  const M = K * K
  if (tokens >= M && tokens % M === 0) return `${tokens / M}M`
  if (tokens >= K && tokens % K === 0) return `${tokens / K}K`
  if (tokens >= M) return `${(tokens / M).toFixed(2).replace(/\.?0+$/, '')}M`
  if (tokens >= K) return `${(tokens / K).toFixed(1).replace(/\.?0+$/, '')}K`
  return String(tokens)
}

interface Props {
  editing: string | null
  models: string[]
  modelConfigs: Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }>
  fetchedModels: string[]
  fetching: boolean
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>
  onFetch: () => void
  onAddModel: (modelId: string) => void
  onRemoveModel: (modelId: string) => void
  onEditModel: (modelId: string | null) => void
  showAddDropdown: boolean
  onToggleAddDropdown: () => void
  onCloseAddDropdown: () => void
  searchQuery: string
  onSearchChange: (val: string) => void
  ui: Record<string, string>
}

export function ModelList({
  editing,
  models,
  modelConfigs,
  fetchedModels,
  fetching,
  knownModels,
  onFetch,
  onAddModel,
  onRemoveModel,
  onEditModel,
  showAddDropdown,
  onToggleAddDropdown,
  onCloseAddDropdown,
  searchQuery,
  onSearchChange,
  ui,
}: Props) {
  return (
    <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--crai-border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{ui.addedModels}</h4>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--crai-bg-tertiary)', color: 'var(--crai-fg-tertiary)' }}>
            {models.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleAddDropdown}
            className="px-2.5 py-1 rounded text-[10px] transition-colors flex items-center gap-1"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', border: '1px solid var(--crai-border)', color: 'var(--crai-fg)' }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {ui.addModel}
          </button>
          <button
            onClick={onFetch}
            disabled={fetching}
            className="px-2.5 py-1 rounded text-[10px] transition-colors flex items-center gap-1"
            style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)' }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {fetching ? ui.fetching : ui.fetchModels}
          </button>
        </div>
      </div>

      {/* 已添加模型列表 */}
      {models.length > 0 ? (
        <div className="space-y-1">
          {models.map(m => {
            const mc = modelConfigs[m] || {}
            const knownCtx = editing ? getModelContextWindow(editing, m, knownModels) : undefined
            const ctx = mc.contextWindow ?? knownCtx ?? 131072
            const displayName = mc.displayName || (editing ? getKnownModelDisplayName(editing, m, knownModels) : undefined) || m
            const ctxLabel = formatCtx(ctx)
            return (
              <div
                key={m}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--crai-bg-secondary)',
                  border: '1px solid transparent',
                }}
              >
                {/* 显示名 */}
                <span
                  className="text-xs font-medium truncate shrink-0"
                  style={{ width: 120 }}
                  title={displayName !== m ? `${displayName}\n${m}` : displayName}
                >
                  {displayName}
                </span>

                {/* 模型 ID */}
                <span
                  className="text-[10px] truncate shrink-0"
                  style={{ width: 80, color: 'var(--crai-fg-tertiary)' }}
                  title={m}
                >
                  {m}
                </span>

                {/* 视觉标记 */}
                {mc.vision && (
                  <span className="text-[10px] shrink-0" title={ui.supportVision}>🖼</span>
                )}

                {/* 上下文长度 */}
                <span
                  className="text-[10px] tabular-nums shrink-0"
                  style={{ color: 'var(--crai-fg-tertiary)', width: 48, textAlign: 'right' as const }}
                >
                  {ctxLabel}
                </span>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <button
                    onClick={() => onEditModel(m)}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:opacity-80"
                    style={{ color: 'var(--crai-fg-tertiary)' }}
                    title={ui.editModel}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onRemoveModel(m)}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:opacity-80"
                    style={{ color: 'var(--crai-destructive)' }}
                    title={ui.removeModel}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-[10px] opacity-40 py-4 text-center rounded-lg" style={{ backgroundColor: 'var(--crai-bg-secondary)' }}>
          {ui.noModelsHint}
        </div>
      )}

      {/* 添加模型下拉面板 */}
      {showAddDropdown && (
        <div
          className="fixed z-50 rounded-xl border overflow-hidden"
          style={{
            left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 320, maxHeight: '70vh',
            backgroundColor: 'var(--crai-bg)',
            borderColor: 'var(--crai-border)',
            boxShadow: 'var(--crai-shadow-modal)',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* 搜索框 */}
          <div className="px-3 pt-3 pb-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={ui.searchModel}
              className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
            />
          </div>

          {/* 模型列表 */}
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {fetchedModels.length > 0 ? (
              fetchedModels
                .filter(m => !searchQuery || m.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(m => {
                  const alreadyAdded = models.includes(m)
                  const knownCtx = editing ? getModelContextWindow(editing, m, knownModels) : undefined
                  const mc = modelConfigs[m]
                  const ctx = mc?.contextWindow ?? knownCtx
                  const displayName = mc?.displayName || (editing ? getKnownModelDisplayName(editing, m, knownModels) : undefined) || m
                  return (
                    <button
                      key={m}
                      onClick={() => { if (!alreadyAdded) { onAddModel(m); onCloseAddDropdown() } }}
                      className="w-full text-left px-3 py-1.5 text-[10px] transition-colors flex items-center gap-2"
                      style={{
                        color: alreadyAdded ? 'var(--crai-fg-tertiary)' : 'var(--crai-fg)',
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                    >
                      <span className="flex-1 truncate">{displayName}</span>
                      {displayName !== m && (
                        <span className="text-[9px] opacity-40 truncate max-w-[80px]">{m}</span>
                      )}
                      {alreadyAdded && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--crai-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {!alreadyAdded && ctx && (
                        <span className="text-[9px] opacity-40 tabular-nums shrink-0">
                          {(ctx / 1000).toFixed(0)}k
                        </span>
                      )}
                    </button>
                  )
                })
            ) : (
              <div className="text-[10px] opacity-40 text-center py-4">
                {ui.fetchFirstHint}
              </div>
            )}
          </div>

          {/* 手动输入 */}
          <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--crai-border)' }}>
            <input
              id="custom-model-input"
              placeholder={ui.customModelPlaceholder}
              className="flex-1 px-2.5 py-1.5 rounded text-[10px] outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && !models.includes(val)) {
                    onAddModel(val)
                    onCloseAddDropdown()
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('custom-model-input') as HTMLInputElement
                const val = input?.value?.trim()
                if (val && !models.includes(val)) {
                  onAddModel(val)
                  onCloseAddDropdown()
                }
              }}
              className="px-2 py-1.5 rounded text-[10px] text-white"
              style={{ backgroundColor: 'var(--crai-accent)' }}
            >
              {ui.manualAddBtn}
            </button>
          </div>
        </div>
      )}

      {/* 背景遮罩 */}
      {showAddDropdown && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          onClick={onCloseAddDropdown}
        />
      )}
    </div>
  )
}
