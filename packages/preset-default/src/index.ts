import type {
  Extension,
  ModelAdapter,
  PromptPipeline,
  PromptResult,
  RuntimeError,
} from '../../core/src'

/**
 * 默认 preset：承载最基础的默认行为。
 * 它不属于 runtime kernel，而是一个可替换的默认策略层。
 */
export function createDefaultPresetExtensions(): Extension[] {
  const builtinDefaults: Extension = {
    name: 'preset-default:builtin-defaults',
    setup(ctx) {
      const placeholderModel: ModelAdapter = {
        name: 'placeholder-model',
        async request() {
          throw {
            code: 'MODEL_ADAPTER_NOT_READY',
            message: '当前没有加载真实模型适配器，请先注册一个 ModelAdapter preset。',
          } satisfies RuntimeError
        },
        async *stream() {
          throw {
            code: 'MODEL_ADAPTER_NOT_READY',
            message: '当前没有加载真实模型适配器，请先注册一个 ModelAdapter preset。',
          } satisfies RuntimeError
        },
      }

      const defaultPromptPipeline: PromptPipeline = {
        async run(input, options): Promise<PromptResult> {
          const session = options?.sessionId
            ? await ctx.runtime.getSession(options.sessionId) ?? await ctx.runtime.createSession(options.metadata)
            : await ctx.runtime.createSession(options?.metadata)

          const responseMessage = {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            createdAt: Date.now(),
            parts: [{ type: 'text', text: 'Preset 默认 pipeline 已接入，后续可替换为真实 turn flow。' }],
          }

          return {
            session,
            turnId: `turn_${Date.now()}`,
            messages: [responseMessage],
            response: {
              message: responseMessage,
            },
          }
        },
      }

      ctx.registry.models.register(placeholderModel.name, placeholderModel)
      ctx.registry.promptPipelines.register('default', defaultPromptPipeline)

      // 这些 hook 作为默认行为占位存在，后续可逐步替换为真正的默认策略。
      ctx.hooks.on('context:build', async (value) => value)
      ctx.hooks.on('persist:before', async (value) => value)
      ctx.hooks.on('persist:after', async (value) => value)
    },
  }

  return [builtinDefaults]
}
