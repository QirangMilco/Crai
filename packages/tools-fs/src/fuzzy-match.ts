/**
 * 模糊文本匹配，用于 search-and-replace 编辑的 fallback。
 *
 * 当精确匹配失败时，用 Jaccard 相似度找最佳近似匹配。
 * 阈值为 0.75（与 snow-cli 一致）。
 */

const SIMILARITY_THRESHOLD = 0.75

/** 将文本按行分割后提取 token 集合（去掉空格和标点的单词）。 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

/** Jaccard 相似度：交集大小 / 并集大小。 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a)
  const setB = tokenize(b)
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

/** 归一化空格的行级匹配。 */
function normalizedLineMatch(searchLines: string[], contentLines: string[], startIdx: number): boolean {
  for (let i = 0; i < searchLines.length; i++) {
    if (startIdx + i >= contentLines.length) return false
    const s = searchLines[i].replace(/\s+/g, ' ').trim()
    const c = contentLines[i + startIdx].replace(/\s+/g, ' ').trim()
    if (s !== c) return false
  }
  return true
}

export interface FuzzyMatchResult {
  /** 匹配在 content 中的起始索引（字符级）。 */
  index: number
  /** 匹配的长度（字符数）。 */
  length: number
  /** 相似度分数。 */
  score: number
}

/**
 * 在 content 中搜索与 searchText 最相似的片段。
 *
 * 搜索策略（逐级 fallback）：
 *   1. 精确字符串匹配
 *   2. 归一化行级匹配（\\s+ → ' '）
 *   3. Jaccard 模糊匹配（阈值 0.75）
 *
 * 返回最佳匹配的 { index, length, score }，无匹配时返回 null。
 */
export function findBestMatch(content: string, searchText: string): FuzzyMatchResult | null {
  const contentLines = content.split('\n')
  const searchLines = searchText.split('\n')

  // Level 1: 精确匹配
  const exactIdx = content.indexOf(searchText)
  if (exactIdx !== -1) {
    return { index: exactIdx, length: searchText.length, score: 1 }
  }

  // Level 2: 归一化行级匹配
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    if (normalizedLineMatch(searchLines, contentLines, i)) {
      // 计算在原始 content 中的字符索引
      const linesBefore = contentLines.slice(0, i)
      const charIdx = linesBefore.join('\n').length + (linesBefore.length > 0 ? 1 : 0)
      const matchedChars = contentLines.slice(i, i + searchLines.length).join('\n')
      return { index: charIdx, length: matchedChars.length, score: 0.9 }
    }
  }

  // Level 3: Jaccard 模糊匹配（滑动窗口）
  const searchLen = searchText.length
  const searchRange = Math.max(searchLen * 2, 200) // 搜索窗口：2 倍搜索长度，至少 200 字符
  let best: FuzzyMatchResult | null = null

  for (let i = 0; i < content.length; i++) {
    const window = content.slice(i, i + searchRange)
    const score = jaccardSimilarity(searchText, window)
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { index: i, length: window.length, score }
    }
  }

  return best
}
