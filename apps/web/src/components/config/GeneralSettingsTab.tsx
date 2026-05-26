/**
 * 通用设置 Tab。
 * 包含 OS 沙箱开关和上下文压缩阈值滑块。
 */

interface Props {
  sandboxEnabled: boolean
  onSandboxChange: (enabled: boolean) => void
  compressionThreshold: string
  onCompressionChange: (threshold: string) => void
  ui: Record<string, string>
}

export function GeneralSettingsTab({
  sandboxEnabled,
  onSandboxChange,
  compressionThreshold,
  onCompressionChange,
  ui,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10">
      <div className="max-w-md space-y-8">
        {/* OS 沙箱开关 */}
        <div
          className="flex items-center justify-between p-4 rounded-lg border"
          style={{ borderColor: 'var(--crai-border)', backgroundColor: 'var(--crai-bg-secondary)' }}
        >
          <div>
            <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--crai-fg)' }}>
              {ui.sandboxMode}
            </div>
            <div className="text-[10px] opacity-60 leading-relaxed">
              {ui.sandboxHint}
            </div>
          </div>
          <button
            onClick={() => onSandboxChange(!sandboxEnabled)}
            className={'relative w-9 h-5 rounded-full transition-colors shrink-0 ' + (sandboxEnabled ? 'bg-green-500' : 'bg-gray-400')}
          >
            <span
              className={
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ' +
                (sandboxEnabled ? 'translate-x-4' : 'translate-x-0')
              }
            />
          </button>
        </div>

        {/* 上下文压缩 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-60">
              {ui.compressionLabel}
            </h3>
          </div>
          <div
            className="p-4 rounded-lg border space-y-4"
            style={{ borderColor: 'var(--crai-border)', backgroundColor: 'var(--crai-bg-secondary)' }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{ui.compressionThreshold}</span>
                <span className="text-xs font-mono">{compressionThreshold}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={compressionThreshold}
                onChange={e => onCompressionChange(e.target.value)}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--crai-accent)]"
                style={{ backgroundColor: 'var(--crai-border)' }}
              />
              <p className="text-[10px] opacity-40 leading-relaxed">
                {ui.compressionHint}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
