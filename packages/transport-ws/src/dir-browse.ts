/**
 * 目录浏览安全工具。
 * 带系统目录过滤和路径规范化。
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

/** 安全地浏览目录。无参数时返回用户主目录。 */
export function browseDir(inputPath?: string): { path: string; dirs: string[]; parent?: string; error?: string } {
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

    const dirs = readdirSync(resolved).filter((e) => {
      if (e.startsWith('.')) return false
      const full = join(resolved, e)
      if (isDenied(full)) return false
      try { return statSync(full).isDirectory() } catch { return false }
    }).sort()

    const parent = resolve(resolved, '..')
    return {
      path: resolved,
      dirs,
      parent: parent === resolved ? undefined : (isDenied(parent) ? undefined : parent),
    }
  } catch (err: any) {
    return { path: inputPath ?? '', dirs: [], error: err.message ?? String(err) }
  }
}
