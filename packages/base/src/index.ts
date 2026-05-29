/**
 * @crai/base — 公共导出
 */
export {
  resolve, join, relative, dirname, basename, extname, sep, normalize,
  resolveAllowedPath, getPathArg, validateToolPaths,
} from './path'

export {
  guardContext,
  hardTruncate,
  checkContext,
  estimateTokens,
  estimateTokensAccurate,
  estimateMessagesTokens,
  estimateMessageTokens,
  generateSummary,
  findPreserveStartIndex,
  cleanOrphanedToolCalls,
} from './context-window'
export type { Summarizer, CompactionGuardOptions, GuardContextResult, ContextCheckResult, CompressionConfig } from './context-window'

export { limitToolResult, truncateToolResult, getToolResultTokenLimit } from './token-limiter'

export { ConsoleLogger } from './logger'
export { sanitizeText, sanitizeParts } from './pii-guard'
export { createSandbox, wrapCommand } from './sandbox'
export type { SandboxOptions, SandboxProvider, SandboxWrappedCommand } from './sandbox'

export { StreamTimeoutError, withIdleTimeout } from './stream-guards'
