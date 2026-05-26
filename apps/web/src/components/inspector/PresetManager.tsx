/**
 * PresetManager — 预设管理。
 *
 * 包含颜色预设选择器、样式预设选择器、保存预设按钮。
 * 将预设选择逻辑从 InspectorPanel 中提取出来。
 */
import { Select } from '../ui'

interface Preset {
  name: string
}

interface Props {
  activeColor: string | null
  activeStyle: string | null
  colorPresets: Preset[]
  stylePresets: Preset[]
  isColorDirty: boolean
  isStyleDirty: boolean
  onColorPresetChange: (name: string) => void
  onStylePresetChange: (name: string) => void
  onSaveColor: () => void
  onSaveStyle: () => void
}

export function PresetManager({
  activeColor, activeStyle,
  colorPresets, stylePresets,
  isColorDirty, isStyleDirty,
  onColorPresetChange, onStylePresetChange,
  onSaveColor, onSaveStyle,
}: Props) {
  return (
    <div className="shrink-0 space-y-1 px-3 py-2 border-b" style={{ borderColor: 'var(--crai-border)' }}>
      {/* 配色 */}
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          配色
        </span>
        <Select
          value={activeColor ?? ''}
          onChange={(v) => { if (v) onColorPresetChange(v) }}
          options={[
            { value: '', label: '— 未选择 —' },
            ...colorPresets.map((p) => ({ value: p.name, label: p.name })),
          ]}
          placeholder="— 未选择 —"
          className="flex-1"
          style={{
            borderColor: isColorDirty ? 'var(--crai-accent)' : 'var(--crai-border)',
          }}
        />
        <button onClick={onSaveColor}
          className="text-[10px] px-1.5 py-1 rounded shrink-0"
          style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
      </div>
      {/* 样式 */}
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          样式
        </span>
        <Select
          value={activeStyle ?? ''}
          onChange={(v) => { if (v) onStylePresetChange(v) }}
          options={[
            { value: '', label: '— 未选择 —' },
            ...stylePresets.map((p) => ({ value: p.name, label: p.name })),
          ]}
          placeholder="— 未选择 —"
          className="flex-1"
          style={{
            borderColor: isStyleDirty ? 'var(--crai-accent)' : 'var(--crai-border)',
          }}
        />
        <button onClick={onSaveStyle}
          className="text-[10px] px-1.5 py-1 rounded shrink-0"
          style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
      </div>
    </div>
  )
}
