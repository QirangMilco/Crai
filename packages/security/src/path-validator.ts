import { resolve } from 'node:path'

/**
 * 校验输入路径在 rootDir 范围内，返回标准化绝对路径。
 *
 * - `resolve(rootDir, '../etc')` → 解析到 rootDir 之外 → 拒绝
 * - `resolve(rootDir, '/etc')` → 绝对路径覆盖 rootDir → 拒绝
 * - `resolve(rootDir, 'src/file.ts')` → 在范围内 → 返回标准化绝对路径
 */
export function resolveAllowedPath(inputPath: string, rootDir: string): string {
  const normalizedRoot = resolve(rootDir)
  const resolved = resolve(normalizedRoot, inputPath)
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`路径拒绝: ${inputPath} 不在工作区内`)
  }
  return resolved
}

/** 已知的文件路径参数名。工具定义中声明为文件路径的参数会被校验。 */
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
 * 返回首个失败的路径信息，或 undefined 表示全部通过。
 */
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
