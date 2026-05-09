/**
 * Crai runtime 包统一出口。
 * 只导出 kernel 核心构造与选项类型。
 */
export { createRuntime } from './createRuntime'
export { createTraceCollector } from './trace'
export type { RuntimeOptions } from './createRuntime'
export type { TraceFn } from './bus'
export type { TraceEntry, TraceMode } from './trace'
