import { promises as fs } from 'node:fs'
import { lineHash } from './line-hash'
import { findBestMatch } from './fuzzy-match'
import { SnapshotManager } from './snapshot-manager'

export interface EditResult {
  success: boolean
  linesChanged: number
  message: string
}

/**
 * 基于 searchContent 的编辑（精确 → 归一化行匹配 → 模糊 fallback）。
 *
 * 替换第 `occurrence` 处匹配（1-indexed，默认 1）。
 * 备份文件到 `.crai/backups/`。
 */
export async function editBySearch(
  filePath: string,
  searchContent: string,
  replaceContent: string,
  occurrence: number,
  snapshots: SnapshotManager,
  rootDir: string,
  sessionId: string,
): Promise<EditResult> {
  const content = await normalizedRead(filePath)
  const normSearch = searchContent.replace(/\r\n/g, '\n')

  let lastEnd = 0
  let found = 0

  for (let attempt = 0; attempt < 100; attempt++) {
    const remaining = content.slice(lastEnd)
    const match = findBestMatch(remaining, normSearch)
    if (!match) break

    found++
    const globalIdx = lastEnd + match.index

    if (found === occurrence) {
      // 快照备份
      const opIndex = await snapshots.snapshot(sessionId, rootDir, [filePath])

      // 替换
      const newContent =
        content.slice(0, globalIdx) +
        replaceContent +
        content.slice(globalIdx + match.length)

      await fs.writeFile(filePath, newContent, 'utf-8')

      const searchLines = normSearch.split('\n').length
      const replaceLines = replaceContent.split('\n').length
      const linesChanged = Math.max(searchLines, replaceLines)

      const matchInfo = match.score < 1
        ? `（模糊匹配，相似度 ${(match.score * 100).toFixed(0)}%）`
        : ''

      return {
        success: true,
        linesChanged,
        message: `已替换第 ${occurrence} 处匹配${matchInfo}，影响约 ${linesChanged} 行。快照序号: ${opIndex}`,
      }
    }

    lastEnd = globalIdx + match.length
  }

  const msg = found === 0
    ? `未找到匹配内容。请确保 searchContent 与文件中内容完全一致。`
    : `仅找到 ${found} 处匹配，未找到第 ${occurrence} 处。`

  return { success: false, linesChanged: 0, message: msg }
}

/**
 * 基于 hashline 锚点的编辑。
 *
 * `startAnchor` 和 `endAnchor` 格式为 `"lineno:hash"`（如 `"42:a3c7"`）。
 * 替换 startAnchor 所在行到 endAnchor 所在行的内容为 `replaceContent`。
 * 单行编辑时 endAnchor 与 startAnchor 相同。
 */
export async function editByHashline(
  filePath: string,
  startAnchor: string,
  endAnchor: string,
  replaceContent: string,
  snapshots: SnapshotManager,
  rootDir: string,
  sessionId: string,
): Promise<EditResult> {
  const content = await normalizedRead(filePath)
  const lines = content.split('\n')

  const startLine = resolveAnchor(startAnchor, lines)
  if (startLine === -1) {
    return { success: false, linesChanged: 0, message: `锚点 ${startAnchor} 不匹配——文件内容可能已变化。` }
  }

  let endLine: number
  if (endAnchor === startAnchor) {
    endLine = startLine
  } else {
    endLine = resolveAnchor(endAnchor, lines)
    if (endLine === -1) {
      return { success: false, linesChanged: 0, message: `锚点 ${endAnchor} 不匹配——文件内容可能已变化。` }
    }
    if (endLine < startLine) {
      return { success: false, linesChanged: 0, message: `endAnchor 行号 ${endLine + 1} 小于 startAnchor 行号 ${startLine + 1}。` }
    }
  }

  // 快照备份
  const opIndex = await snapshots.snapshot(sessionId, rootDir, [filePath])

  // 替换
  const beforeLines = lines.slice(0, startLine)
  const afterLines = lines.slice(endLine + 1)
  const newContent = beforeLines.join('\n') +
    (beforeLines.length > 0 ? '\n' : '') +
    replaceContent +
    (afterLines.length > 0 ? '\n' : '') +
    afterLines.join('\n')

  await fs.writeFile(filePath, newContent, 'utf-8')

  const linesChanged = (endLine - startLine + 1)

  return {
    success: true,
    linesChanged,
    message: `已按锚点替换行 ${startLine + 1}-${endLine + 1}，影响约 ${linesChanged} 行。快照序号: ${opIndex}`,
  }
}

// ── 内部函数 ────────────────────────────────────────

/** 读取并归一化文件。 */
async function normalizedRead(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return raw.replace(/\r\n/g, '\n')
}

/** 解析锚点 "lineno:hash"，验证 lineHash 是否匹配。返回 0-indexed 行号，不匹配返回 -1。 */
function resolveAnchor(anchor: string, lines: string[]): number {
  const match = anchor.match(/^(\d+):([0-9a-f]+)$/)
  if (!match) return -1

  const lineNum = parseInt(match[1], 10) - 1 // 转为 0-indexed
  if (lineNum < 0 || lineNum >= lines.length) return -1

  const expectedHash = match[2]
  const actualHash = lineHash(lines[lineNum])
  return actualHash === expectedHash ? lineNum : -1
}


