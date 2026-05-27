/**
 * InfoIsland — 顶栏中间的 Dynamic Island。
 *
 * 默认显示紧凑的信息胶囊（模型名）。
 * Hover 展开显示更多详情（供应商、模型、思考深度、模式、会话耗时）。
 *
 * 纯展示，通过 React state + hover 事件控制显隐。
 */
import { useState, useEffect } from 'react'
import { ui } from '../ConfigPanel.strings'

interface Props {
  model?: string
  provider?: string
  thinkingLevel?: string
  mode?: string
  connected?: boolean
}

export function InfoIsland({
  model,
  provider,
  thinkingLevel,
  mode,
  connected,
}: Props) {
  const [sessionStart] = useState(Date.now())
  const [elapsed, setElapsed] = useState('0s')
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - sessionStart) / 1000)
      if (secs < 60) setElapsed(`${secs}秒`)
      else setElapsed(`${Math.floor(secs / 60)}分${secs % 60}秒`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStart])

  if (!model && !provider) return null

  return (
    <div
      className="relative select-none inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 胶囊 */}
      <div
        className="flex items-center gap-2 px-2.5 py-0.5 rounded-md cursor-default transition-all duration-150"
        style={{
          backgroundColor: hovered ? 'var(--crai-bg-5)' : 'var(--crai-bg-tertiary)',
          border: '1px solid var(--crai-border)',
        }}
      >
        <span className="text-[11px] font-medium truncate max-w-[100px]" style={{ color: 'var(--crai-fg)' }}>
          {model || provider}
        </span>
        {connected !== undefined && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: connected ? 'var(--crai-success)' : 'var(--crai-destructive)' }}
          />
        )}
      </div>

      {/* 弹出详情 */}
      {hovered && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 pt-2"
          style={{ zIndex: 200 }}
        >
          <div
            className="rounded-lg text-xs whitespace-nowrap leading-relaxed"
            style={{
              backgroundColor: 'var(--crai-bg)',
              border: '1px solid var(--crai-border)',
              boxShadow: 'var(--crai-shadow-elevated)',
              padding: '10px 14px',
              color: 'var(--crai-fg)',
            }}
          >
            <table>
              <tbody>
                {provider && (
                  <tr>
                    <td className="pr-6" style={{ color: 'var(--crai-fg-40)' }}>{ui.infoProvider}</td>
                    <td>{provider}</td>
                  </tr>
                )}
                {model && (
                  <tr>
                    <td className="pr-6" style={{ color: 'var(--crai-fg-40)' }}>{ui.infoModel}</td>
                    <td>{model}</td>
                  </tr>
                )}
                {thinkingLevel && (
                  <tr>
                    <td className="pr-6" style={{ color: 'var(--crai-fg-40)' }}>{ui.infoThinking}</td>
                    <td style={{ textTransform: 'capitalize' }}>{thinkingLevel}</td>
                  </tr>
                )}
                {mode && (
                  <tr>
                    <td className="pr-6" style={{ color: 'var(--crai-fg-40)' }}>{ui.infoMode}</td>
                    <td>{mode}</td>
                  </tr>
                )}
                <tr>
                  <td className="pr-6" style={{ color: 'var(--crai-fg-40)' }}>{ui.infoElapsed}</td>
                  <td className="tabular-nums">{elapsed}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
