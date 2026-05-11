import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Search-and-replace edit on a file.
 *
 * Finds exact match of `searchContent` in the file and replaces with
 * `replaceContent`. If `occurrence` is specified, replaces the nth match
 * (1-indexed). Default replaces the first match.
 *
 * Returns a summary of what changed.
 */
export async function editFile(
  filePath: string,
  searchContent: string,
  replaceContent: string,
  occurrence?: number,
): Promise<{ success: boolean; linesChanged: number; message: string }> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')

  // Build search patterns: try exact line-by-line first, then substring
  let index = content.indexOf(searchContent)

  if (index === -1) {
    // Try normalizing whitespace
    const normalizedSearch = searchContent.replace(/\r\n/g, '\n')
    const normalizedContent = content.replace(/\r\n/g, '\n')
    index = normalizedContent.indexOf(normalizedSearch)

    if (index === -1) {
      return {
        success: false,
        linesChanged: 0,
        message: `未找到匹配内容。请确保 searchContent 与文件中内容完全一致。`,
      }
    }

    // Find occurrence
    let currentIdx = -1
    let occ = occurrence ?? 1
    for (let i = 0; i < occ; i++) {
      currentIdx = normalizedContent.indexOf(normalizedSearch, currentIdx + 1)
      if (currentIdx === -1) {
        return {
          success: false,
          linesChanged: 0,
          message: `仅找到 ${i} 处匹配，未找到第 ${occ} 处。`,
        }
      }
    }

    // Perform replacement on original content (preserve original line endings)
    const beforeMatch = content.slice(0, currentIdx)
    const afterMatch = content.slice(currentIdx + normalizedSearch.length)
    const newContent = beforeMatch + replaceContent + afterMatch

    await fs.writeFile(filePath, newContent, 'utf-8')

    // Count changed lines
    const beforeLines = beforeMatch.split('\n')
    const changedInSearch = searchContent.split('\n').length
    const linesChanged = Math.min(changedInSearch, replaceContent.split('\n').length)

    return { success: true, linesChanged, message: `已替换第 ${occ} 处匹配，影响约 ${linesChanged} 行。` }
  }

  // Exact match found
  let currentIdx = -1
  let occ = occurrence ?? 1
  for (let i = 0; i < occ; i++) {
    currentIdx = content.indexOf(searchContent, currentIdx + 1)
    if (currentIdx === -1) {
      return {
        success: false,
        linesChanged: 0,
        message: `仅找到 ${i} 处匹配，未找到第 ${occ} 处。`,
      }
    }
  }

  // Back up original file
  const backupPath = filePath + '.bak'
  await fs.copyFile(filePath, backupPath).catch(() => {})

  // Perform replacement
  const beforeMatch = content.slice(0, currentIdx)
  const afterMatch = content.slice(currentIdx + searchContent.length)
  const newContent = beforeMatch + replaceContent + afterMatch

  await fs.writeFile(filePath, newContent, 'utf-8')

  const changedInSearch = searchContent.split('\n').length
  const linesChanged = Math.min(changedInSearch, replaceContent.split('\n').length)

  return { success: true, linesChanged, message: `已替换第 ${occ} 处匹配，影响约 ${linesChanged} 行。备份文件: ${backupPath}` }
}
