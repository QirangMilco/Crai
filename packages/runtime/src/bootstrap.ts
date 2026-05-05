import type { Extension, ExtensionContext } from '../../core/src'

/**
 * 扩展引导加载器。
 * 先加载内置扩展（如 preset-default），再加载用户传入的 runtime extensions。
 * 扩展的卸载（dispose）由 RuntimeHandle.dispose 统一触发。
 */
export async function bootstrapRuntimeExtensions(
  runtimeExtensions: Array<Extension | string> | undefined,
  builtinExtensions: Extension[],
  ctx: ExtensionContext,
) {
  const load = async (extensions: Array<Extension | string> | undefined) => {
    if (!extensions?.length) return
    for (const ext of extensions) {
      if (typeof ext === 'string') continue
      if (ext.permissions?.length) {
        // 权限校验后续由独立 permission 能力负责。
      }
      await ext.setup(ctx)
    }
  }

  // 内置扩展先加载，确保默认能力先于用户扩展就绪
  await load(builtinExtensions)
  await load(runtimeExtensions)
}
