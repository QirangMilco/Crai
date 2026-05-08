/**
 * Runtime 层内部常量。
 * 只在本包内使用，不对外暴露。
 */

/** 内置 storage 注册名，用于通过 RuntimeOptions.storage 传入的存储适配器。 */
export const BUILTIN_STORAGE_NAME = 'builtin:storage'

/** 兜底模型名。当 prompt() 未指定 model 且无模型注册时 fallback 使用。值由 @crai/core 的 PLACEHOLDER_MODEL_NAME 定义。 */
export { PLACEHOLDER_MODEL_NAME as FALLBACK_MODEL_NAME } from '@crai/core'
