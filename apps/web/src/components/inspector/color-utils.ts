/**
 * 颜色解析工具：用 canvas 渲染 1px 像素并读取实际 RGBA。
 * 供 InspectorPanel 及各子组件共享使用。
 */

const _hexCache = new Map<string, string>()

export function toHexCssVar(cssVar: string): string {
  const cached = _hexCache.get(cssVar)
  if (cached) return cached
  return computeHex(cssVar)
}

/** 清空缓存（颜色变更后调用） */
export function clearHexCache() { _hexCache.clear() }

function computeHex(cssVar: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  if (!raw) { _hexCache.set(cssVar, '#4f46e5'); return '#4f46e5' }

  const canvas = document.createElement('canvas')
  canvas.width = 1; canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) { _hexCache.set(cssVar, '#4f46e5'); return '#4f46e5' }

  let colorValue = raw
  if (raw.includes('var(') || raw.startsWith('color-mix')) {
    const proxy = document.createElement('div')
    const rootStyle = document.documentElement.style
    const vars = Array.from(rootStyle).map((k) => `${k}:${rootStyle.getPropertyValue(k)}`).join(';')
    proxy.style.cssText = vars
    document.body.appendChild(proxy)
    proxy.style.backgroundColor = `var(${cssVar})`
    colorValue = getComputedStyle(proxy).backgroundColor
    document.body.removeChild(proxy)
  }

  ctx.fillStyle = colorValue
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
  _hexCache.set(cssVar, hex)
  return hex
}
