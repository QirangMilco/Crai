/** DeepSeek provider extension 工厂。注册为 Crai Extension。 */
import type { Extension } from '@crai/core'
import { DeepSeekAdapter, type DeepSeekAdapterOptions } from './adapter'
import { DEFAULT_MODELS, EXTENSION_NAME } from './constants'

export interface DeepSeekProviderOptions {
  apiKey: string
  baseURL?: string
  adapterName?: string
  models?: string[]
}

/**
 * 创建 DeepSeek provider extension。
 * 注册后 runtime 可通过 prompt({ model: 'deepseek-v4-flash' }) 调用。
 *
 * 自动处理：
 *   - reasoning_content 捕获与回传（thinking mode）
 *   - tool-call 消息的 content 非 null 保证
 *   - max_tokens 思考模式阈值调整
 */
export function createDeepSeekProvider(options: DeepSeekProviderOptions): Extension {
  const models = options.models ?? [...DEFAULT_MODELS]

  const adapterOptions: DeepSeekAdapterOptions = {
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    adapterName: options.adapterName,
  }

  return {
    name: EXTENSION_NAME,
    setup(ctx) {
      const adapter = new DeepSeekAdapter(adapterOptions)
      for (const modelName of models) {
        ctx.registry.models.register(modelName, adapter)
      }
    },
  }
}
