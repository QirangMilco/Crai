/**
 * 行 hash 计算。为每行内容生成短 hash 作为锚点。
 *
 * 使用 DJB2 算法，取前 4 位 hex。
 * 在单个文件内两行碰撞的概率极低，足够做编辑锚点。
 */
export function lineHash(line: string): string {
  let hash = 5381
  for (let i = 0; i < line.length; i++) {
    hash = ((hash << 5) + hash) + line.charCodeAt(i)
    hash = hash & hash
  }
  return (hash >>> 0).toString(16).padStart(4, '0').slice(0, 4)
}
