/** Runtime 包统一出口。只导出核心构造与类型。 */
export { createRuntime } from './createRuntime'
export { createTraceCollector } from './trace'
export { isDebugScope, debugLog, DEBUG_SCOPES } from './debug'
export type { RuntimeOptions } from './createRuntime'
export { createHookBus, createEventBus } from './bus'
export type { TraceFn } from './bus'
export type { TraceEntry, TraceMode } from './trace'
