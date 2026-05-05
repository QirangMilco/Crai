/**
 * 扩展引导：按顺序加载内置扩展和运行时扩展。
 *
 * 加载顺序：builtin → runtime，确保内置默认行为先注册，可被运行时扩展覆盖。
 * 当前限制：
 * - string 类型扩展（动态加载）被跳过，需 @crai/loader-ts 支持
 * - 权限校验为空实现，需 PermissionAdapter 接入后补全
 * - 未发射 extension.loaded / extension.unloaded 事件
 */
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
  // 内置扩展先加载，运行时扩展后加载；同优先级下后者可覆盖前者
  const load = async (extensions: Array<Extension | string> | undefined) => {
    if (!extensions?.length) return
    for (const ext of extensions) {
      // TODO: 动态加载 string 类型扩展（需 @crai/loader-ts）
      if (typeof ext === 'string') continue
      // TODO: 权限校验，需 PermissionAdapter 接入
      if (ext.permissions?.length) {
        // 权限校验后续由独立 permission 能力负责。
      }
      // TODO: 发射 extension.loaded 事件
      await ext.setup(ctx)
    }
  }

  await load(builtinExtensions)
  await load(runtimeExtensions)
}
