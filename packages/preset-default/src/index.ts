/**
 * 默认 preset 扩展包。
 *
 * 作为可替换的默认策略层，提供：
 * 1. 占位模型适配器 — 未接入真实 provider 时保证 runtime 可启动
 * 2. 默认 PromptPipeline — 将 prompt 委托为 session 创建 + 固定响应
 *    （后续应替换为调用 turnRunner 的真实流程）
 * 3. 空 hook 占位 — 确保 context:build / persist 管道有默认 handler
 *
 * 此包不属于 runtime kernel，可被其他 preset 完全替换。
 */
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

      // 默认 prompt 流水线：创建/复用 session → 返回固定响应
      // TODO: 替换为调用 turnRunner.runTurn 的真实流程
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

      // 空 hook 占位：后续 preset 可用更高 priority 的 handler 覆盖默认行为
      ctx.hooks.on('context:build', async (value) => value)
      ctx.hooks.on('persist:before', async (value) => value)
      ctx.hooks.on('persist:after', async (value) => value)
    },
  }

  return [builtinDefaults]
}
