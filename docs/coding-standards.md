# 编码规范 (Coding Standards)

## 1. 裸字符串管理 (Literal String Management)

项目中所有具有业务语义的字符串**不得**在代码中直接硬编码（裸字符串），必须定义为命名常量统一引用。

### 1.1 事件名称 (Event Names)

**正确：**
```typescript
import { EVENTS } from '@crai/core'

events.emit(EVENTS.TURN_STARTED, { session, turnId })
events.emit(EVENTS.MODEL_COMPLETED, { session, response })
```

**错误：**
```typescript
events.emit('turn.started', { session, turnId })
events.emit('model.completed', { session, response })
```

所有事件常量定义在 [packages/core/src/constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 的 `EVENTS` 对象中。

### 1.2 Hook 名称 (Hook Names)

**正确：**
```typescript
import { HOOKS } from '@crai/core'

hooks.run(HOOKS.CONTEXT_BUILD, { session, messages }, { runtime })
hooks.on(HOOKS.PERSIST_BEFORE, async () => ({ continue: true }))
```

**错误：**
```typescript
hooks.run('context:build', { session, messages }, { runtime })
hooks.on('persist:before', async () => ({ continue: true }))
```

所有 Hook 常量定义在 [packages/core/src/constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 的 `HOOKS` 对象中。

### 1.3 错误代码 (Error Codes)

**正确：**
```typescript
import { ERROR_CODES } from '@crai/core'

throw {
  code: ERROR_CODES.MODEL_ADAPTER_NOT_READY,
  message: 'Model adapter not ready',
} satisfies RuntimeError
```

**错误：**
```typescript
throw {
  code: 'MODEL_ADAPTER_NOT_READY', // 裸字符串
  message: 'Model adapter not ready',
}
```

所有错误代码常量定义在 [packages/core/src/constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 的 `ERROR_CODES` 对象中。

### 1.4 安全/权限字面量

使用联合类型（如 `ToolSafetyLevel`、`PermissionMode`）时，优先引用值常量而非直接写字面量：

**正确：**
```typescript
import { TOOL_SAFETY_LEVELS, PERMISSION_MODES, PERMISSION_KINDS, MEMORY_SCOPES, OBSERVATION_TYPES } from '@crai/core'

const level: ToolSafetyLevel = TOOL_SAFETY_LEVELS.DANGEROUS
const mode: PermissionMode = PERMISSION_MODES.ASK
const kind = PERMISSION_KINDS.TOOL
```

**可接受（类型安全的字面量）：**
```typescript
const level: ToolSafetyLevel = 'dangerous'
```

所有值常量定义在 [packages/core/src/constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 中。

### 1.5 文件系统路径

文件系统路径必须使用变量或配置引用，不得硬编码。路径的每一段（目录名、文件名）都应来自该层级的常量、配置或环境变量。

**正确：**
```typescript
// 1. 从本层常量读取基目录名和子路径段
import { join } from 'path'
import { homedir } from 'os'
import { CRAI_DIR_NAME, CONFIG_DIR_NAME } from './constants'

const configDir = join(homedir(), CRAI_DIR_NAME, CONFIG_DIR_NAME)

// 2. 从运行时配置中读取
const baseDir = await settings.get('runtime.baseDir') ?? DEFAULT_BASE_DIR
const configDir = join(baseDir, 'config')
```

**错误：**
```typescript
// 硬编码用户路径
const configDir = '/Users/username/.crai/config'
// 硬编码目录名（虽然用了 homedir()，但 '.crai' 和 'config' 仍是魔术字符串）
const configDir = join(homedir(), '.crai', 'config')
```

### 1.6 注册名称

Adapter、Extension 等在注册时使用的名称字符串应使用命名常量或在相近位置定义：

```typescript
// 推荐：在文件顶部定义
const ADAPTER_NAME = 'preset-default:permission'
ctx.registry.permissions.register(ADAPTER_NAME, adapter)

// 避免：
ctx.registry.permissions.register('preset-default:permission', adapter)
```

### 1.7 新增共享常量

新增**跨层共享**的事件、Hook 或错误代码时，必须：

1. 在 [constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 中添加对应的常量定义
2. 在 `EventMap`（[events.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/events.ts)）或 `HookMap`（[hooks.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/hooks.ts)）中添加对应的类型签名
3. 在现有代码中引用常量而非裸字符串

如果常量仅在当前包内部使用，不应放进 `packages/core/src/constants.ts`，而应在当前包内创建自己的 `constants.ts`（见第 4 节）。

---

## 2. 国际化 (i18n) 规范

### 2.1 基本原则

所有面向用户的字符串（错误消息、日志消息、UI 文本等）必须通过 i18n 适配器获取，不得直接硬编码。

### 2.2 I18nAdapter 接口

i18n 适配器定义在 [packages/core/src/i18n.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/i18n.ts)：

```typescript
export interface I18nAdapter {
  name: string
  t(key: string, params?: Record<string, string | number>): string
  setLanguage(lang: string): void
  getLanguage(): string
}
```

### 2.3 使用方式

从 `RuntimeRegistries` 中获取 i18n 适配器：

```typescript
const i18n = ctx.registry.i18n.get('preset-default:i18n')
if (i18n) {
  const msg = i18n.t('error.model.adapterNotReady')
  const withParams = i18n.t('permission.safe.blocked', { reason: 'dangerous tool' })
}
```

### 2.4 消息键命名规范

消息键采用点号分隔的层级命名：

```
<作用域>.<领域>.<具体描述>
```

- **作用域**: `error`, `log`, `permission`, `status`, `ui` 等
- **领域**: 如 `model`, `tool`, `session`, `storage`, `extension`
- **具体描述**: 小写驼峰，如 `adapterNotReady`, `requestFailed`

示例：
- `error.model.adapterNotReady`
- `log.turn.started`
- `permission.ask.confirm`

### 2.5 参数插值

消息中可包含 `{paramName}` 占位符，通过 `t()` 的第二个参数传入：

```typescript
// 翻译资源中："Blocked in safe mode: {reason}"
i18n.t('permission.safe.blocked', { reason: 'dangerous tool' })
// → "Blocked in safe mode: dangerous tool"
```

### 2.6 添加新语言

在 [packages/preset-default/src/i18n/](file:///Users/qirang/Documents/Projects/Crai/packages/preset-default/src/i18n/) 目录下添加新的语言文件，然后在 [index.ts](file:///Users/qirang/Documents/Projects/Crai/packages/preset-default/src/i18n/index.ts) 中注册：

```typescript
import { ja } from './ja' // 新建 ja.ts

const BUNDLED: Record<string, Record<string, string>> = {
  en,
  'zh-CN': zhCN,
  ja, // 注册新语言
}
```

### 2.7 Error Code 与 i18n 的关系

错误代码（`ERROR_CODES`）是结构化错误的机器可读标识，用于程序逻辑判断。i18n 消息是面向用户的自然语言描述。两者不可互相替代：

```typescript
// ✓ 正确：既使用错误代码（机器可读），也使用 i18n（用户可读）
throw {
  code: ERROR_CODES.MODEL_ADAPTER_NOT_READY,
  message: i18n?.t('error.model.adapterNotReady') ?? 'Model adapter not ready',
}
```

---

## 3. 类型与值的一致性

### 3.1 联合类型 + 值常量的双重导出

在 [constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 中定义值常量，在 [types.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/types.ts) 中定义类型别名：

```typescript
// constants.ts — 运行时值
export const TOOL_SAFETY_LEVELS = {
  SAFE: 'safe',
  RESTRICTED: 'restricted',
  DANGEROUS: 'dangerous',
} as const

// types.ts — 编译时类型
export type ToolSafetyLevel = 'safe' | 'restricted' | 'dangerous'
```

这种做法既保证了编译期类型检查，也提供了运行时可引用的常量值。

### 3.2 新增字段原则

- 如果字段值在运行时被引用（比较、赋值、switch-case），必须同时添加值常量和类型
- 如果字段值仅在类型层面使用（如接口定义），可只保留类型字面量

---

## 4. 常量的层级归属

不同层级的常量归各自层级管理，核心只定义跨层共享的契约常量。

### 4.1 Core 层（跨层共享）

[packages/core/src/constants.ts](file:///Users/qirang/Documents/Projects/Crai/packages/core/src/constants.ts) 只存放**跨所有包共享**的常量：

- 事件名（`EVENTS`）— 所有层都会 emit/listen
- Hook 名（`HOOKS`）— 所有层都会 run/on
- 错误码（`ERROR_CODES`）— 所有层都可能抛出/捕获
- 语义枚举值（`TOOL_SAFETY_LEVELS`, `PERMISSION_MODES` 等）— 跨包的类型契约

```typescript
// packages/core/src/constants.ts — 仅限跨层共享
export const EVENTS = {
  TURN_STARTED: 'turn.started',
  TURN_COMPLETED: 'turn.completed',
} as const
```

### 4.2 Runtime 层（包内私有）

Runtime 内部产生的常量应放在 `packages/runtime/src/constants.ts`，不对外暴露。

```typescript
// packages/runtime/src/constants.ts — runtime 内部使用
export const INTERNAL_EVENTS = {
  CACHE_CHECK: 'runtime:cache:check',
  CACHE_HIT: 'runtime:cache:hit',
} as const

export const DEFAULT_POLL_INTERVAL = 100
```

这些常量不应出现在 `EventMap` 或 `HookMap` 中——如果未来某个事件需要对外暴露，再升格到 Core 层。

### 4.3 Preset / Extension 层（包内私有 + 可配置）

Preset 或 Extension 中的常量分为两类：

**包内私有常量**：直接在当前包的 `src/constants.ts` 或就近定义：

```typescript
// packages/preset-default/src/constants.ts
export const DANGEROUS_COMMANDS = [
  'rm', 'sudo', 'chmod',
] as const

export const BLOCKED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'GITHUB_TOKEN',
] as const
```

**可配置值**：不应作为编译时常量，应通过 `SettingsStore` 或适配器选项注入：

```typescript
// 正确：通过构造参数或配置注入
export function createDefaultPermissionAdapter(options?: {
  blockedEnvVars?: string[]
  dangerousCommands?: string[]
}) {
  const blocked = options?.blockedEnvVars ?? DEFAULT_BLOCKED_ENV_VARS
  const dangerous = options?.dangerousCommands ?? DEFAULT_DANGEROUS_COMMANDS
  // ...
}
```

```typescript
// 正确：通过 SettingsStore 运行时读取
const dangerousCommands = await settings.get('security.dangerousCommands') ?? DEFAULT_DANGEROUS_COMMANDS
```

```typescript
// 错误：将可配置值硬编码为不可变的编译时常量，导致用户无法覆盖
const BLOCKED_ENV_VARS = ['ANTHROPIC_API_KEY', ...] // 需要改代码才能变更
```

> 判断准则：如果用户或上层调用方**有合理理由想改变这个值**，它就是可配置值，不应作为编译时常量。

### 4.4 常量升级路径

```
包内私有常量 →（被其他包引用）→ 升格为跨层共享常量
编译时常量    →（用户需要覆盖）→ 改为可配置值
```

- 先从当前包内定义开始，真正需要跨包共享时再移至 Core 层
- 不要预判（YAGNI），不要在阶段一就把所有东西放进 Core

### 4.5 各层常量文件位置速查

| 层级 | 文件位置 | 用途 |
|------|---------|------|
| Core | `packages/core/src/constants.ts` | 跨层共享契约（事件/Hook/错误码） |
| Runtime | `packages/runtime/src/constants.ts` | Runtime 内部私有常量 |
| Preset | `packages/preset-default/src/constants.ts` | Preset 内部私有常量和默认值 |
| Extension | `packages/<ext>/src/constants.ts` | 各扩展内部私有常量 |
