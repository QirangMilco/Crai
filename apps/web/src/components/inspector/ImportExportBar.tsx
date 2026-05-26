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
        className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导出 JSON">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        导出
      </button>
      <button onClick={onImportJson}
        className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导入 JSON">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导入
      </button>
      <button onClick={onExportMd}
        className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导出 Markdown">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        设计
      </button>
      <button onClick={onImportMd}
        className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
        title="导入 Markdown">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg>
        设计
      </button>
      <button onClick={onReset}
        className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded"
        style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}
        title="重置全部">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        重置
      </button>
    </div>
  )
}
