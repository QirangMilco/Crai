/**
 * @crai/runtime — .craignore 文件解析
 *
 * 从工作区根目录的 .craignore 文件中读取排除模式。
 * 语法与 .gitignore 一致（`*`、`**`、`!` 取反、`#` 注释）。
 *
 * 设计文档：../../refs/version-management-design.md#7-排除-rules--craignore
 */

import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 从工作区根目录加载 .craignore 中的排除模式。
 * 如果文件不存在，返回空数组（不排除任何路径）。
 */
export async function loadCraignore(rootDir: string): Promise<string[]> {
  const filePath = resolve(rootDir, '.craignore')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return parseCraignore(content)
  } catch {
    return []
  }
}

/**
 * 解析 .craignore 文件内容，返回排除模式列表。
 * 语法：
 *   - `#` 开头的行是注释
 *   - 空行跳过
 *   - `!` 取反当前行之前的模式（简化实现：以 `!` 开头的行跳过，不处理取反）
 *   - 其余行为排除模式（目录或文件路径前缀匹配）
 */
export function parseCraignore(content: string): string[] {
  const patterns: string[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // 跳过注释和空行和取反行
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    // 去掉尾部斜杠（目录匹配）
    const pattern = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
    patterns.push(pattern)
  }
  return patterns
}
