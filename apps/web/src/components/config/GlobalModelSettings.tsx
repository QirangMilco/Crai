/**
 * 底部全局默认模型 + 工具模型选择器。
 */

import { Select } from '../ui'

interface Props {
  editModel: string
  editToolModel: string
  onDefaultModelChange: (val: string) => void
  onToolModelChange: (val: string) => void
  allModelOptions: { provider: string; model: string; label: string }[]
  ui: Record<string, string>
}

export function GlobalModelSettings({
  editModel,
  editToolModel,
  onDefaultModelChange,
  onToolModelChange,
  allModelOptions,
  ui,
}: Props) {
  return (
    <div className="shrink-0 px-5 py-3 border-t" style={{ borderColor: 'var(--crai-border)' }}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium opacity-50 mb-1">{ui.defaultModelLabel}</div>
          <Select
            value={editModel}
            onChange={onDefaultModelChange}
            options={[
              { value: '', label: ui.autoSelect },
              ...allModelOptions.map(opt => ({ value: opt.label, label: opt.label })),
            ]}
            placeholder={ui.autoSelect}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium opacity-50 mb-1">{ui.toolModelLabel}</div>
          <Select
            value={editToolModel}
            onChange={onToolModelChange}
            options={[
              { value: '', label: ui.useDefaultModel },
              ...allModelOptions.map(opt => ({ value: opt.label, label: opt.label })),
            ]}
            placeholder={ui.useDefaultModel}
          />
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] opacity-40">{ui.defaultModelHint}</span>
        <span className="text-[9px] opacity-40">{ui.toolModelHint}</span>
      </div>
    </div>
  )
}
