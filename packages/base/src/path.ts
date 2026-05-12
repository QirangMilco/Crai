/**
 * @crai/base/path — 跨包共享的路径工具函数。
 */
import { resolve } from 'node:path'
export { resolve, join, relative, dirname, basename, extname, sep, normalize } from 'node:path'

/**
 * 校验输入路径在 rootDir 范围内，返回标准化绝对路径。
 *
 * - `resolve(rootDir, '../etc')` → 拒绝
 * - `resolve(rootDir, '/etc')` → 拒绝
 * - `resolve(rootDir, 'src/file.ts')` → 返回标准化绝对路径
 *
 * tools-fs 与 security 共用此函数，消除重复。
 */
export function resolveAllowedPath(inputPath: string, rootDir: string): string {
  const normalizedRoot = resolve(rootDir)
  const resolved = resolve(normalizedRoot, inputPath)
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`路径拒绝: ${inputPath} 不在工作区内`)
  }
  return resolved
}

/** 从参数对象中提取 path 参数并校验（用于 tools-fs）。 */
export function getPathArg(args: Record<string, unknown>, rootDir: string): string {
  const path = args.path
  if (typeof path !== 'string' || !path) {
    throw new Error('path 参数必须是非空字符串')
  }
  return resolveAllowedPath(path, rootDir)
}

/** 已知的文件路径参数名。 */
const KNOWN_PATH_ARGS = new Set([
  'path',
  'dir',
  'file',
  'source',
  'target',
  'destination',
  'root',
  'baseDir',
  'workingDir',
])

/**
 * 从参数对象中提取可能为文件路径的值，校验是否在 rootDir 内。
 * 返回首个失败的路径信息，或 undefined 表示全部通过（用于 security）。 */
export function validateToolPaths(
  args: Record<string, unknown>,
  rootDir: string,
): { argName: string; value: string; reason: string } | undefined {
  for (const [key, value] of Object.entries(args)) {
    if (typeof value !== 'string') continue
    if (!KNOWN_PATH_ARGS.has(key)) continue

    try {
      resolveAllowedPath(value, rootDir)
    } catch (err: any) {
      return { argName: key, value, reason: err.message }
    }
  }
  return undefined
}
