/**
 * 模型编辑弹窗。
 * 编辑模型显示名、输入上下文、输出上限、视觉支持。
 */

import { ComboInput } from '../ui'

function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>): number | undefined {
  return knownModels?.[provider.toLowerCase()]?.[model]?.contextWindow
}

function formatCtxExact(tokens: number): string {
  return tokens.toLocaleString('en-US')
}

interface Props {
  editingModel: string
  editing: string | null
  editFormName: string
  editFormCtx: string
  editFormMaxOut: string
  editFormVision: boolean
  onNameChange: (val: string) => void
  onCtxChange: (val: string) => void
  onMaxOutChange: (val: string) => void
  onVisionChange: (val: boolean) => void
  onSave: () => void
  onClose: () => void
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>
  ui: Record<string, string>
}

export function ModelEditModal({
  editingModel,
  editing,
  editFormName,
  editFormCtx,
  editFormMaxOut,
  editFormVision,
  onNameChange,
  onCtxChange,
  onMaxOutChange,
  onVisionChange,
  onSave,
  onClose,
  knownModels,
  ui,
}: Props) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 rounded-xl p-5 space-y-4"
        style={{
          left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 360,
          backgroundColor: 'var(--crai-bg)',
          border: '1px solid var(--crai-border)',
          boxShadow: 'var(--crai-shadow-modal)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{ui.editModelTitle}</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 text-sm">✕</button>
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] opacity-50">{ui.modelIdLabel}</label>
          <div className="text-xs py-1.5 px-2 rounded" style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg-tertiary)' }}>
            {editingModel}
          </div>
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] opacity-50">{ui.displayNameLabel}</label>
          <input
            value={editFormName}
            onChange={e => onNameChange(e.target.value)}
            placeholder={editingModel}
            className="w-full px-2 py-1.5 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] opacity-50">{ui.contextLengthLabel}</label>
            <ComboInput
              presets={[
                { label: '64K', value: 65536 },
                { label: '128K', value: 131072 },
                { label: '256K', value: 262144 },
                { label: '512K', value: 524288 },
                { label: '1M', value: 1048576 },
              ]}
              value={editFormCtx}
              onChange={onCtxChange}
              placeholder={formatCtxExact(getModelContextWindow(editing!, editingModel, knownModels) ?? 131072)}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] opacity-50">{ui.maxOutputLabel}</label>
            <ComboInput
              presets={[
                { label: '8K', value: 8192 },
                { label: '16K', value: 16384 },
                { label: '32K', value: 32768 },
                { label: '64K', value: 65536 },
              ]}
              value={editFormMaxOut}
              onChange={onMaxOutChange}
              placeholder="16,384"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-50">{ui.visionLabel}</span>
          <button
            onClick={() => onVisionChange(!editFormVision)}
            className="w-8 h-4 rounded-full relative transition-colors"
            style={{ backgroundColor: editFormVision ? 'var(--crai-accent)' : 'var(--crai-border)' }}
          >
            <div
              className="w-3 h-3 rounded-full absolute top-0.5 transition-all"
              style={{
                left: editFormVision ? 'calc(100% - 16px)' : '4px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            />
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[10px]"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
          >
            {ui.cancel}
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1.5 rounded text-[10px] font-medium text-white"
            style={{ backgroundColor: 'var(--crai-accent)' }}
          >
            {ui.save}
          </button>
        </div>
      </div>
    </>
  )
}
