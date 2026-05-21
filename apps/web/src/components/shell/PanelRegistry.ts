/**
 * PanelRegistry — 面板注册与配置系统。
 *
 * 管理所有可用面板的定义及其位置/顺序/可见性配置。
 * 配置持久化在 localStorage，支持未来扩展新面板（如变更管理）。
 */
import type React from 'react'

export interface PanelDef {
  /** 面板唯一标识 */
  id: string
  /** 显示名（固定栏 tooltip 等） */
  label: string
  /** 固定栏图标（lucide ReactNode 或 emoji 字符串） */
  icon: React.ReactNode
  /** 默认放置侧（未配置时使用） */
  defaultSide: 'left' | 'right'
  /** 是否默认可见 */
  defaultVisible: boolean
  /** 面板组件渲染函数 */
  render: (props: PanelRenderProps) => React.ReactNode
}

export interface PanelRenderProps {
  /** 面板当前可见宽度（展开时） */
  width: number
  /** 面板是否处于悬浮展开状态 */
  hovered: boolean
  /** 发送 WS 消息的回调 */
  send: (msg: any) => void
}

export interface PanelSlotConfig {
  /** 放在哪个侧 */
  side: 'left' | 'right'
  /** 在该侧的位置顺序（0 为最内，数字越大越靠边缘） */
  order: number
  /** 是否可见 */
  visible: boolean
}

const STORAGE_KEY = 'crai:panelConfig'

// ── 运行时状态 ──

let defs: PanelDef[] = []
let configs: Record<string, PanelSlotConfig> = {}
let listeners: Array<() => void> = []

function notify() {
  for (const fn of listeners) fn()
}

/** 从 localStorage 加载配置 */
function loadConfig(): Record<string, PanelSlotConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

/** 持久化配置到 localStorage */
function saveConfig(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

// ── 公共 API ──

/** 注册一组面板定义（应用启动时调用一次） */
export function registerPanels(panels: PanelDef[]): void {
  defs = panels
  const saved = loadConfig()
  configs = {}
  for (const p of panels) {
    const existing = saved[p.id]
    configs[p.id] = existing ?? {
      side: p.defaultSide,
      order: 0,
      visible: p.defaultVisible,
    }
  }
  notify()
}

/** 获取所有已注册的面板定义 */
export function getPanelDefs(): PanelDef[] {
  return defs
}

/** 获取指定面板的当前配置 */
export function getPanelConfig(id: string): PanelSlotConfig | undefined {
  return configs[id]
}

/** 更新某个面板的配置 */
export function setPanelConfig(id: string, patch: Partial<PanelSlotConfig>): void {
  const cur = configs[id]
  if (!cur) return
  configs[id] = { ...cur, ...patch }
  saveConfig()
  notify()
}

/** 获取某个侧的所有面板（按 order 排序） */
export function getSidePanels(side: 'left' | 'right'): Array<{ def: PanelDef; config: PanelSlotConfig }> {
  const result: Array<{ def: PanelDef; config: PanelSlotConfig }> = []
  for (const d of defs) {
    const c = configs[d.id]
    if (c && c.side === side && c.visible) {
      result.push({ def: d, config: c })
    }
  }
  result.sort((a, b) => a.config.order - b.config.order)
  return result
}

/** 获取挂在 fixed bar 上的所有面板（含不可见的，因为 fixed bar 上仍然要显示图标） */
export function getAllSidePanels(side: 'left' | 'right'): Array<{ def: PanelDef; config: PanelSlotConfig }> {
  const result: Array<{ def: PanelDef; config: PanelSlotConfig }> = []
  for (const d of defs) {
    const c = configs[d.id]
    if (c && c.side === side) {
      result.push({ def: d, config: c })
    }
  }
  result.sort((a, b) => a.config.order - b.config.order)
  return result
}

/** 订阅配置变更 */
export function subscribe(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
