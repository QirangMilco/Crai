/**
 * ImportExportBar — 导入/导出操作栏。
 *
 * 包含：JSON 导出、JSON 导入、Markdown 导出、Markdown 导入、重置按钮。
 */
interface Props {
  onExportJson: () => void
  onImportJson: () => void
  onExportMd: () => void
  onImportMd: () => void
  onReset: () => void
}

export function ImportExportBar({ onExportJson, onImportJson, onExportMd, onImportMd, onReset }: Props) {
  return (
    <div className="shrink-0 px-3 py-2 border-b flex gap-1" style={{ borderColor: 'var(--crai-border)' }}>
      <button onClick={onExportJson}
        className="flex-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导出 JSON">📤</button>
      <button onClick={onImportJson}
        className="flex-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导入 JSON">📥</button>
      <button onClick={onExportMd}
        className="flex-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导出 Markdown 设计规格">📄</button>
      <button onClick={onImportMd}
        className="flex-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导入 Markdown 设计规格">📂</button>
      <button onClick={onReset}
        className="flex-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}
        title="重置全部">↺</button>
    </div>
  )
}
