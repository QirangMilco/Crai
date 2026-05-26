/**
 * ColorSwatches — 颜色色块展示区。
 *
 * 以彩色方块展示一组基色 token，点击选中高亮。
 * 配合 InspectorPanel 使用：选定后可在下方 TokenGroupList 中精细编辑。
 */
import { toHexCssVar } from './color-utils'
import type { TokenDef } from '../../theme/tokens'

interface Props {
  /** 要展示的 token 定义列表 */
  tokens: TokenDef[]
  /** 当前选中的 token 名（用于高亮） */
  activeToken: string | null
  /** 点击色块时的回调 */
  onSelect: (tokenName: string) => void
}

export function ColorSwatches({ tokens, activeToken, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid var(--crai-border)' }}>
      {tokens.map((token) => {
        const hex = toHexCssVar(token.name)
        const isActive = activeToken === token.name
        return (
          <button
            key={token.name}
            onClick={() => onSelect(token.name)}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] transition-all duration-150"
            style={{
              backgroundColor: isActive ? 'var(--crai-bg-5)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--crai-accent)' : 'var(--crai-border)'}`,
              color: 'var(--crai-fg-secondary)',
            }}
            title={`${token.label} — ${hex}`}
          >
            <span
              className="inline-block w-4 h-4 rounded-sm shrink-0"
              style={{
                backgroundColor: hex,
                border: '1px solid var(--crai-border)',
              }}
            />
            <span className="truncate max-w-[64px]">{token.label}</span>
          </button>
        )
      })}
    </div>
  )
}
