/**
 * 左侧供应商列表。
 * 展示预设 + 自定义供应商，支持选中、添加、删除。
 */

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
  providers: ProviderEntry[]
  editing: string | null
  onSelect: (name: string) => void
  onAdd: () => void
  ui: Record<string, string>
}

export function ProviderList({ providers, editing, onSelect, onAdd, ui }: Props) {
  const presetEntries = providers.filter(e => e.isPreset)
  const customEntries = providers.filter(e => !e.isPreset)

  return (
    <div className="w-40 shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--crai-border)' }}>
      <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
        <div className="text-[10px] font-medium px-2 py-1 uppercase tracking-wider opacity-40">
          {ui.presetLabel}
        </div>
        {presetEntries.map((entry) => (
          <button
            key={entry.name}
            onClick={() => onSelect(entry.name)}
            className="w-full text-left px-2 py-2 rounded transition-colors text-xs flex items-center justify-between group"
            style={{
              backgroundColor: editing === entry.name ? 'var(--crai-bg-tertiary)' : 'transparent',
              color: editing === entry.name ? 'var(--crai-accent)' : 'var(--crai-fg)',
            }}
          >
            <span className="truncate">{entry.label}</span>
            {entry.configured && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title={ui.configured} />
            )}
          </button>
        ))}

        <div className="text-[10px] font-medium px-2 py-1 mt-4 uppercase tracking-wider opacity-40">
          {ui.customLabel}
        </div>
        {customEntries.map((entry) => (
          <button
            key={entry.name}
            onClick={() => onSelect(entry.name)}
            className="w-full text-left px-2 py-2 rounded transition-colors text-xs flex items-center justify-between group"
            style={{
              backgroundColor: editing === entry.name ? 'var(--crai-bg-tertiary)' : 'transparent',
              color: editing === entry.name ? 'var(--crai-accent)' : 'var(--crai-fg)',
            }}
          >
            <span className="truncate">{entry.label}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title={ui.configured} />
          </button>
        ))}
      </div>

      <div className="p-2 border-t" style={{ borderColor: 'var(--crai-border)' }}>
        <button
          onClick={onAdd}
          className="w-full py-1.5 rounded border border-dashed text-[11px] transition-colors"
          style={{
            borderColor: editing === '__new__' ? 'var(--crai-accent)' : 'var(--crai-border)',
            color: editing === '__new__' ? 'var(--crai-accent)' : 'var(--crai-fg-secondary)',
            backgroundColor: editing === '__new__' ? 'var(--crai-bg-3)' : 'transparent',
          }}
        >
          {ui.addProvider}
        </button>
      </div>
    </div>
  )
}
