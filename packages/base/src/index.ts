/**
 * @crai/base — 底层共享工具函数。
 *
 * 放 core（纯 TS 契约）和 runtime（运行内核）都不合适，
 * 但又需要跨包公用的 Node 工具函数。
 * 主要用于消除 tools-fs、security、config 等包之间的重复代码。
 */
export {
  resolve, join, relative, dirname, basename, extname, sep, normalize,
  resolveAllowedPath, getPathArg, validateToolPaths,
} from './path'
