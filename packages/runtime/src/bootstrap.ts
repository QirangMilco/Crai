import type { Extension, ExtensionContext, PermissionCheckRequest, PermissionDecision } from '@crai/core'
import { HOOKS, TRUST_LEVELS } from '@crai/core'

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

async function loadSingleExtension(
  ext: Extension,
  ctx: ExtensionContext,
  allowFullAccess: boolean,
): Promise<void> {
  // 检查 trust 级别
  const trust = ext.manifest?.trust ?? TRUST_LEVELS.RESTRICTED
  if (trust === TRUST_LEVELS.FULL_ACCESS && !allowFullAccess) {
    ctx.logger.warn?.(`扩展 "${ext.name}" 声明了 full-access 但当前 runtime 不允许，降级为 restricted`)
  }

  // 检查声明式权限
  const perms = ext.manifest?.permissions ?? ext.permissions
  if (perms?.length) {
    for (const perm of perms) {
      const decision = await checkPermission({
        kind: perm.kind ?? 'custom',
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
 * @param allowFullAccess 是否允许 full-access 级别扩展（默认 false）。
 */
export async function bootstrapRuntimeExtensions(
  runtimeExtensions: Array<Extension | string> | undefined,
  builtinExtensions: Extension[],
  ctx: ExtensionContext,
  allowFullAccess = false,
) {
  const load = async (extensions: Array<Extension | string> | undefined) => {
    if (!extensions?.length) return
    for (const ext of extensions) {
      if (typeof ext === 'string') continue
      await loadSingleExtension(ext, ctx, allowFullAccess)
    }
  }

  await load(builtinExtensions)
  await load(runtimeExtensions)
}

/** 增量加载单个扩展。 */
export async function setupExtension(
  ext: Extension,
  ctx: ExtensionContext,
  allowFullAccess = false,
): Promise<void> {
  await loadSingleExtension(ext, ctx, allowFullAccess)
}
