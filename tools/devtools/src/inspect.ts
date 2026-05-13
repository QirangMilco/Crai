/**
 * 仓库巡检助手。
 * 探索项目结构、查找源文件、分析包依赖。
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** 查找指定目录下的所有包（含有 src/ 目录的目录视为包）。 */
export function findPackages(rootDir: string): string[] {
  const results: string[] = []
  try {
    const entries = readdirSync(rootDir)
    for (const entry of entries) {
      const full = join(rootDir, entry)
      if (statSync(full).isDirectory()) {
        const src = join(full, 'src')
        try {
          if (statSync(src).isDirectory()) {
            results.push(entry)
          }
        } catch {
          // 无 src 目录，不是包
        }
      }
    }
  } catch {
    // 目录不存在或不可读
  }
  return results.sort()
}

/** 查找目录下的所有 .ts 源文件（递归）。 */
export function findSourceFiles(rootDir: string, maxDepth = 5): string[] {
  const results: string[] = []

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const full = join(dir, entry)
        try {
          const s = statSync(full)
          if (s.isDirectory()) {
            if (!entry.startsWith('.') && entry !== 'node_modules') {
              walk(full, depth + 1)
            }
          } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            results.push(relative(rootDir, full))
          }
        } catch {
          // 跳过
        }
      }
    } catch {
      // 跳过
    }
  }

  walk(rootDir, 0)
  return results.sort()
}
