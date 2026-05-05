import type { Extension, ExtensionContext } from '../../core/src'

/**
 * 运行时启动辅助。
 * 这里只负责装配扩展，不负责具体默认策略定义。
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

  await load(builtinExtensions)
  await load(runtimeExtensions)
}
