import type { Extension, ExtensionContext, PermissionCheckRequest, PermissionDecision } from '../../core/src'

async function checkPermission(
  request: PermissionCheckRequest,
  ctx: ExtensionContext,
): Promise<PermissionDecision> {
  const result = await ctx.hooks.run('permission:check', {
    session: request.session ?? { id: '', createdAt: 0, updatedAt: 0 },
    request,
    decision: { allow: false, reason: '默认拒绝：无权限适配器处理该请求' },
  }, { runtime: ctx.runtime })

  return result.decision
}

/**
 * 扩展引导加载器。
 * 先加载内置扩展（如 preset-default），再加载用户传入的 runtime extensions。
 * 加载时对每个扩展的 permissions 声明进行校验，拒绝则抛出错误。
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
        for (const perm of ext.permissions) {
          const decision = await checkPermission({
            kind: 'extension',
            action: perm.action,
            payload: perm.payload,
          }, ctx)
          if (!decision.allow) {
            throw new Error(
              `扩展 "${ext.name}" 的权限 "${perm.action}" 被拒绝: ${decision.reason ?? '无原因'}`,
            )
          }
        }
      }
      await ext.setup(ctx)
    }
  }

  // 内置扩展先加载，确保默认能力先于用户扩展就绪
  await load(builtinExtensions)
  await load(runtimeExtensions)
}
