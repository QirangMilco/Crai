import type { ModelRequest, ModelResponse, RuntimeError } from '../../core/src'

/**
 * 当前阶段的默认模型请求行为。
 * 还未接入真实 provider 时，显式抛出结构化错误。
 */
export async function requestPlaceholderModel(_request: ModelRequest): Promise<ModelResponse> {
  throw {
    code: 'MODEL_ADAPTER_NOT_READY',
    message: '当前 runtime 还没有接入真实模型适配器',
  } satisfies RuntimeError
}
