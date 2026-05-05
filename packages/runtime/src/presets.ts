import type { Extension, ModelAdapter, RuntimeError } from '../../core/src'

/**
 * @deprecated 默认 preset 已迁移至独立包 @crai/preset-default。
 * 此文件保留仅用于过渡期兼容，后续会被移除。
 * 承载最基础的默认行为，这些行为不属于 core，也不应写死在 runtime 主体里。
 */
export function createBuiltinPresetExtensions(): Extension[] {
  const builtinDefaults: Extension = {
    name: 'builtin-defaults',
    setup(ctx) {
      // 这里先只注册一个最小的占位模型适配器，方便 dev 启动时有默认行为。
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

      // 默认上下文策略留作 preset 可扩展点，先保留 Hook 入口但不写死业务逻辑。
      ctx.hooks.on('context:build', async () => ({ continue: true }))
      ctx.hooks.on('persist:before', async () => ({ continue: true }))
      ctx.hooks.on('persist:after', async () => ({ continue: true }))
    },
  }

  return [builtinDefaults]
}
