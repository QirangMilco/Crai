/**
 * 目录浏览安全工具。
 * 带系统目录过滤和路径规范化。
 * 支持同时列出目录和文件。
 */
import { readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

// ── 禁止浏览的系统目录 ──

const DENY_DIRS = new Set([
  '/etc', '/proc', '/sys', '/dev', '/boot', '/private/etc', '/private/var/db',
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\System32',
])

function isDenied(resolved: string): boolean {
  const norm = resolve(resolved)
  for (const d of DENY_DIRS) {
    if (norm === d || norm.startsWith(d + sep)) return true
  }
  return false
}

export interface FileEntry {
  name: string
  /** 完整路径 */
  path: string
  /** 文件大小（字节），目录为 0 */
  size: number
  /** 最后修改时间（时间戳 ms） */
  mtime: number
  /** 是否为目录 */
  isDirectory: boolean
}

export interface BrowseResult {
  path: string
  dirs: string[]
  files?: FileEntry[]
  parent?: string
  error?: string
}

interface BrowseOptions {
  /** 是否同时返回文件列表 */
  showFiles?: boolean
}

/** 安全地浏览目录。无参数时返回用户主目录。 */
export function browseDir(inputPath?: string, options?: BrowseOptions): BrowseResult {
  const { showFiles } = options ?? {}
  try {
    if (!inputPath) {
      const home = homedir()
      let dirs: string[] = []
      try {
        dirs = readdirSync(home).filter((e) => {
          if (e.startsWith('.')) return false
          try { return statSync(join(home, e)).isDirectory() } catch { return false }
        }).sort()
      } catch {}
      return { path: home, dirs, parent: undefined }
    }

    const resolved = resolve(inputPath)
    if (isDenied(resolved)) {
      return { path: resolved, dirs: [], error: '不允许浏览此目录' }
    }

    const entries = readdirSync(resolved)
    const dirs: string[] = []
    const files: FileEntry[] = []

    for (const e of entries) {
      if (e.startsWith('.')) continue
      const full = join(resolved, e)
      if (isDenied(full)) continue
      try {
        const stat = statSync(full)
        if (stat.isDirectory()) {
          dirs.push(e)
        } else if (showFiles) {
          files.push({ name: e, path: full, size: stat.size, mtime: stat.mtimeMs, isDirectory: false })
        }
      } catch { /* skip unreadable */ }
    }

    dirs.sort()
    files.sort((a, b) => a.name.localeCompare(b.name))

    const parent = resolve(resolved, '..')
    return {
      path: resolved,
      dirs,
      files: showFiles ? files : undefined,
      parent: parent === resolved ? undefined : (isDenied(parent) ? undefined : parent),
    }
  } catch (err: any) {
    return { path: inputPath ?? '', dirs: [], error: err.message ?? String(err) }
  }
}
