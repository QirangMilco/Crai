/**
 * Runtime 内置 preset 扩展。
 *
 * 提供最小可运行默认行为：占位模型适配器 + 空 hook 占位。
 * 注意：preset-default 包提供了更完整的默认 PromptPipeline 实现，
 * 两者存在占位模型适配器的重复定义，后续应统一到 preset-default。
 */
import type { Extension, ModelAdapter, RuntimeError } from '../../core/src'

/**
 * 内置 preset：承载最基础的默认行为。
 * 这些行为不属于 core，也不应该写死在 runtime 主体里。
 */
export function createBuiltinPresetExtensions(): Extension[] {
  const builtinDefaults: Extension = {
    name: 'builtin-defaults',
    setup(ctx) {
      // 占位模型：未接入真实 provider 时保证 runtime 可启动（hollow-by-default）
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

      ctx.registry.models.register(placeholderModel.name, placeholderModel)

      // 空 hook 占位：确保管道中至少有一个 handler，后续 preset 可用 replace/patch 覆盖
      ctx.hooks.on('context:build', async (value) => value)
      ctx.hooks.on('persist:before', async (value) => value)
      ctx.hooks.on('persist:after', async (value) => value)
    },
  }

  return [builtinDefaults]
}
