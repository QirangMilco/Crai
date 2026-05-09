/**
 * Crai extension-sdk。
 * 扩展作者只需 import 此包即可编写扩展，无需直接知晓 core 包的存在。
 */
import type { Extension, ExtensionContext, ExtensionManifest, ExtensionPermissionDeclaration } from '@crai/core'

// ============================================================
// 类型重导出 — 扩展作者无需知晓 @crai/core 的位置
// ============================================================

export type {
  Artifact,
  ContextBundle,
  ID,
  Logger,
  MemoryEntry,
  MemoryProvenance,
  MemoryScope,
  Message,
  MessagePart,
  MessageRole,
  Metadata,
  ModelContext,
  Observation,
  PermissionCheckRequest,
  PermissionDecision,
  PermissionMode,
  RuntimeError,
  RuntimeInput,
  SandboxScope,
  Session,
  SessionSummary,
  TextPart,
  ImagePart,
  ToolCallPart,
  ToolResultPart,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolSafetyLevel,
} from '@crai/core'

export type {
  AdapterContext,
  CacheAdapter,
  Command,
  CommandRegistry,
  Disposable,
  EventBus,
  EventMap,
  Extension,
  ExtensionConfigStore,
  ExtensionContext,
  ExtensionManifest,
  ExtensionModule,
  ExtensionPermissionDeclaration,
  HookBus,
  HookHandler,
  HookContext,
  HookMap,
  HookResult,
  I18nAdapter,
  MemoryAdapter,
  MemoryQueryInput,
  Middleware,
  ModelAdapter,
  ModelMiddleware,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  PermissionAdapter,
  PromptOptions,
  PromptPipeline,
  PromptResult,
  Registry,
  RuntimeHandle,
  RuntimeRegistries,
  SettingsStore,
  StorageAdapter,
  ToolDefinition,
  ToolHandler,
  ToolProvider,
  ToolResolver,
  TransportAdapter,
  TransportContext,
} from '@crai/core'

export {
  BUS_SKIP,
  BusNoHandlerError,
  BusTimeoutError,
} from '@crai/core'

// ============================================================
// 扩展辅助函数
// ============================================================

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
