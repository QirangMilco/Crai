/** OpenAI provider extension 工厂。创建后可注册 4 个默认模型到 runtime。 */
import type { Extension } from '../../../core/src'
import { OpenAIAdapter, type OpenAIAdapterOptions } from './adapter'
import { DEFAULT_MODELS, EXTENSION_NAME } from './constants'

export interface OpenAIProviderOptions {
  apiKey: string
  baseURL?: string
  adapterName?: string
  models?: string[]
}

/**
 * 创建 OpenAI provider extension。
 * 注册后 runtime 可通过 prompt({ model: 'gpt-4o' }) 调用。
 * 通过 Extension 机制加载，支持 loader-ts 热更新。
 */
export function createOpenAIProvider(options: OpenAIProviderOptions): Extension {
  const models = options.models ?? [...DEFAULT_MODELS]

  const adapterOptions: OpenAIAdapterOptions = {
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    adapterName: options.adapterName,
  }

  return {
    name: EXTENSION_NAME,
    setup(ctx) {
      const adapter = new OpenAIAdapter(adapterOptions)
      for (const modelName of models) {
        ctx.registry.models.register(modelName, adapter)
      }
    },
  }
}
