/**
 * FixedBar — 侧栏收起时显示的固定栏。
 *
 * 垂直放置图标按钮，鼠标悬浮触发对应侧的侧栏展开。
 * 当侧栏展开且鼠标移到 FixedBar 时不会重新触发展开
 * （由 ShellLayout 管理展开/收起状态机）。
 */
import type { PanelDef, PanelSlotConfig } from './PanelRegistry'

interface FixedBarPanel {
  def: PanelDef
  config: PanelSlotConfig
}

interface Props {
  side: 'left' | 'right'
  panels: FixedBarPanel[]
  /** 当前展开的面板 id（无展开则为 null） */
  expandedPanelId: string | null
  onHoverPanel: (panelId: string | null) => void
}

export function FixedBar({ side, panels, expandedPanelId, onHoverPanel }: Props) {
  return (
    <div
      className="flex flex-col items-center shrink-0 z-20"
      style={{
        width: 'var(--crai-sidebar-fixed-bar-width, 36px)',
        backgroundColor: 'var(--crai-bg)',
        borderRight: side === 'left' ? '1px solid var(--crai-border)' : undefined,
        borderLeft: side === 'right' ? '1px solid var(--crai-border)' : undefined,
        paddingTop: 8,
        gap: 2,
      }}
    >
      {panels.map(({ def, config }) => (
        <button
          key={def.id}
          title={config.visible ? def.label : `${def.label} (隐藏)`}
          onMouseEnter={() => onHoverPanel(def.id)}
          onMouseLeave={() => onHoverPanel(null)}
          onClick={() => {
            // 点击切换可见性不在此处处理
          }}
          className="flex items-center justify-center rounded transition-colors"
          style={{
            width: 28,
            height: 28,
            fontSize: 14,
            opacity: config.visible ? (def.id === expandedPanelId ? 1 : 0.6) : 0.3,
            backgroundColor: def.id === expandedPanelId ? 'var(--crai-bg-tertiary)' : 'transparent',
          }}
        >
          {def.icon}
        </button>
      ))}
    </div>
  )
}
