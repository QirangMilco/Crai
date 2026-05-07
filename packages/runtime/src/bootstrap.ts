import type { Extension, ExtensionContext, PermissionCheckRequest, PermissionDecision } from '../../core/src'
import { HOOKS } from '../../core/src'

async function checkPermission(
  request: PermissionCheckRequest,
  ctx: ExtensionContext,
): Promise<PermissionDecision> {
  const result = await ctx.hooks.run(HOOKS.PERMISSION_CHECK, {
    session: request.session ?? { id: '', createdAt: 0, updatedAt: 0 },
    request,
    decision: { allow: false, reason: '默认拒绝：无权限适配器处理该请求' },
  }, { runtime: ctx.runtime })

  return result.decision
}

async function loadSingleExtension(ext: Extension, ctx: ExtensionContext): Promise<void> {
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

/**
 * 扩展引导加载器。
 * 支持一次性加载数组和增量加载单个扩展。
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
      await loadSingleExtension(ext, ctx)
    }
  }

  await load(builtinExtensions)
  await load(runtimeExtensions)
}

/** 增量加载单个扩展。 */
export async function setupExtension(ext: Extension, ctx: ExtensionContext): Promise<void> {
  await loadSingleExtension(ext, ctx)
}
