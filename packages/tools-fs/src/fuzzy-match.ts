/**
 * 模糊文本匹配，基于 Levenshtein 编辑距离（从 snow-cli 移植）。
 *
 * 以行级滑动窗口扫描文件内容，用 Levenshtein 距离计算相似度。
 * 归一化空格后做比较，避免空格差异导致假阴性。
 */

const SIMILARITY_THRESHOLD = 0.75

/** 归一化空格：collapse 连续空白为单个空格，trim 两端。 */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Levenshtein 编辑距离。带早退：超出 maxDistance 时提前返回。 */
function levenshteinDistance(a: string, b: string, maxDistance: number = Infinity): number {
  if (a === b) return 0
  const lenA = a.length
  const lenB = b.length
  if (Math.abs(lenA - lenB) > maxDistance) return maxDistance + 1

  let prev = Array.from({ length: lenB + 1 }, (_, i) => i)

  for (let i = 1; i <= lenA; i++) {
    const curr: number[] = [i]
    let minInRow = i
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      curr[j] = val
      minInRow = Math.min(minInRow, val)
    }
    if (minInRow > maxDistance) return maxDistance + 1
    prev = curr
  }
  return prev[lenB]
}

/** 行级滑动窗口内的相似度。 */
function windowSimilarity(search: string, window: string): number {
  const normSearch = normalize(search)
  const normWindow = normalize(window)
  const maxLen = Math.max(normSearch.length, normWindow.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(normSearch, normWindow, Math.ceil(maxLen * (1 - SIMILARITY_THRESHOLD)))
  return 1 - distance / maxLen
}

export interface FuzzyMatchResult {
  /** 匹配在 content 中的起始索引（字符级）。 */
  index: number
  /** 匹配的长度（字符数）。 */
  length: number
  /** 相似度分数（0-1）。 */
  score: number
}

/**
 * 在 content 中搜索与 searchText 最相似的片段。
 *
 * 策略（逐级 fallback）：
 *   1. 精确字符串匹配
 *   2. 归一化行级精确匹配（collapse 空格后逐行精确比较）
 *   3. Levenshtein 行级滑动窗口匹配（阈值 0.75）
 *
 * 返回最佳匹配，无匹配时返回 null。
 */
export function findBestMatch(content: string, searchText: string): FuzzyMatchResult | null {
  const contentLines = content.split('\n')
  const searchLines = searchText.split('\n')

  // Level 1: 精确匹配
  const exactIdx = content.indexOf(searchText)
  if (exactIdx !== -1) {
    return { index: exactIdx, length: searchText.length, score: 1 }
  }

  // Level 2: 归一化行级精确匹配
  const normSearchLines = searchLines.map(normalize)
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let match = true
    for (let j = 0; j < searchLines.length; j++) {
      if (normalize(contentLines[i + j]) !== normSearchLines[j]) {
        match = false
        break
      }
    }
    if (match) {
      const linesBefore = contentLines.slice(0, i)
      const charIdx = linesBefore.join('\n').length + (linesBefore.length > 0 ? 1 : 0)
      const matchedChars = contentLines.slice(i, i + searchLines.length).join('\n')
      return { index: charIdx, length: matchedChars.length, score: 0.9 }
    }
  }

  // Level 3: Levenshtein 行级滑动窗口匹配
  let best: FuzzyMatchResult | null = null
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const windowContent = contentLines.slice(i, i + searchLines.length).join('\n')
    const score = windowSimilarity(searchText, windowContent)
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      const linesBefore = contentLines.slice(0, i)
      const charIdx = linesBefore.join('\n').length + (linesBefore.length > 0 ? 1 : 0)
      best = { index: charIdx, length: windowContent.length, score }
    }
  }

  return best
}
