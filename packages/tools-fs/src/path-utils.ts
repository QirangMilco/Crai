import { resolve } from 'node:path'

const KNOWN_PATH_ARGS = new Set([
  'path', 'dir', 'file', 'source', 'target', 'destination',
])

/**
 * 校验输入路径在 rootDir 范围内，返回标准化绝对路径。
 * 工具内部防御纵深——即使安全层被绕过，工具自身也会拒绝越界路径。
 */
export function resolveAllowedPath(inputPath: string, rootDir: string): string {
  const normalizedRoot = resolve(rootDir)
  const resolved = resolve(normalizedRoot, inputPath)
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`路径拒绝: ${inputPath} 不在工作区内`)
  }
  return resolved
}

/** 从参数对象中提取 path 参数并校验。 */
export function getPathArg(args: Record<string, unknown>, rootDir: string): string {
  const path = args.path
  if (typeof path !== 'string' || !path) {
    throw new Error('path 参数必须是非空字符串')
  }
  return resolveAllowedPath(path, rootDir)
}
