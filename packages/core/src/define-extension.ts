import type { Extension, ExtensionContext, ExtensionManifest, ExtensionPermissionDeclaration } from './hooks'

export interface DefineExtensionConfig {
  name: string
  manifest?: ExtensionManifest
  permissions?: ExtensionPermissionDeclaration[]
  setup: (ctx: ExtensionContext) => void | Promise<void>
  dispose?: () => void | Promise<void>
}

/** 创建类型安全的 Extension 对象。 */
export function defineExtension(config: DefineExtensionConfig): Extension {
  return {
    name: config.name,
    manifest: config.manifest,
    permissions: config.permissions,
    setup: config.setup,
    dispose: config.dispose,
  }
}
