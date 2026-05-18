/** Mock provider extension 工厂。不经网络，用于调试和测试。 */
import type { Extension, Logger } from '@crai/core'
import { MockDeepSeekAdapter } from './adapter'

export interface MockProviderOptions {
  logger?: Logger
}

const MOCK_MODELS = [
  'mock',
]

export function createMockProvider(options: MockProviderOptions = {}): Extension {
  return {
    name: 'mock-provider',
    setup(ctx) {
      const adapter = new MockDeepSeekAdapter({ logger: options.logger })
      for (const modelName of MOCK_MODELS) {
        ctx.registry.models.register(modelName, adapter)
      }
      ctx.registry.thinkingLevels.register('mock', ['off', 'auto', 'low', 'medium', 'high', 'xhigh', 'max'])
    },
  }
}
