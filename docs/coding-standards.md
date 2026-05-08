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

### 3.1 通用规则

**如果字符串值在运行时被引用（比较、赋值、switch-case），必须通过 `as const` 常量引用，不得出现裸字面量。**

**如果字符串值仅在类型定义中作为判别式标签或第三方接口映射出现，且每个值在 union 中只出现一次（不会有多处维护的问题），允许保持裸字面量。**

### 3.2 运行时值 + 类型定义 → 从常量派生

对于在运行时被引用且同时在类型定义中出现的值（如 `ToolSafetyLevel`、`PermissionMode`、`MemoryScope`、`MessageRole`、`TrustLevel`、`PermissionKind`）：

```typescript
// constants.ts — 唯一事实来源
export const TOOL_SAFETY_LEVELS = {
  SAFE: 'safe',
  RESTRICTED: 'restricted',
  DANGEROUS: 'dangerous',
} as const

// 类型从常量派生
export type ToolSafetyLevel = typeof TOOL_SAFETY_LEVELS[keyof typeof TOOL_SAFETY_LEVELS]

// types.ts — 导入并重导出派生类型
export type { ToolSafetyLevel } from './constants'
```

运行时引用用常量：
```typescript
// ✅ 正确
if (safetyLevel === TOOL_SAFETY_LEVELS.DANGEROUS)

// ❌ 禁止
if (safetyLevel === 'dangerous')
```

### 3.3 仅在类型层面使用的值 → 裸字面量

对于仅在类型定义中作为判别式标签出现、不在运行时被引用的值（如 `ModelStreamEvent.type` 的 `'text-start'`、`TextPart.type` 的 `'text'`、`OpenAIMessage.role` 的 `'system'`）：

```typescript
// events.ts — ✅ 每个值在 union 中只出现一次
export type ModelStreamEvent =
  | { type: 'text-start' }
  | { type: 'text-delta'; delta: string }
  | { type: 'text-end' }

// types.ts — ✅ 每个值在各自接口中只出现一次
export interface TextPart {
  type: 'text'
  text: string
}
```

允许裸字面量的条件是：**这个值在类型定义之外没有任何一处运行时代码引用它。** 如果后来某段运行时代码需要引用它（比如 `if (event.type === 'text-start')`），那段代码必须使用常量而非裸字面量——但这不需要改动类型定义。

### 3.4 第三方 API 接口

第三方 API 的接口映射（如 OpenAI 请求/响应体的类型定义）中，字符串值是对外部规范的描述而非 Crai 的领域逻辑，允许保持裸字面量。运行时值与第三方 API 交互时仍应引用常量。

```typescript
// adapter.ts — ✅ 裸字面量，描述 OpenAI 规范
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
}

// adapter.ts — ✅ 运行时用常量
result.push({ role: OPENAI_ROLES.ASSISTANT, content: text })
```

### 3.5 注册名称

Adapter、Extension、Model 等的注册名称应定义为包级 `constants.ts` 中的命名常量：

```typescript
// constants.ts
export const ADAPTER_NAME = 'storage:fs-default'

// index.ts — ✅ 引用常量
ctx.registry.storages.register(ADAPTER_NAME, adapter)
```

### 3.6 判断准则

有疑问时问一个问题：**这个字符串值，修改它时需要改几处代码？**

- **1 处**（仅在类型定义的 union 中）→ 裸字面量 ✅
- **≥2 处**（类型定义 + 运行时引用/比较/赋值）→ 定义到 constants.ts，类型派生，运行时引用常量

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

### 1.8 包内私有字符串（HTTP、类型字面量、API 内部值）

裸字符串管理不仅适用于契约层（事件/Hook/错误码），也适用于**包内私有**的字符串值，包括但不限于：

| 类别 | 示例 |
|------|------|
| HTTP 方法、路径、Header | `'POST'`, `'/chat/completions'`, `'Content-Type'`, `'Authorization'` |
| 认证方案前缀 | `'Bearer'`, `'Basic'` |
| SSE/流式协议标记 | `'data: '`, `'[DONE]'` |
| 内部类型/角色映射 | `'system'`, `'user'`, `'assistant'`, `'tool'`（消息角色） |
| Adapter 内部的 Part type | `'text'`, `'tool-call'`, `'image'` |
| ID 前缀 | `'msg_'`, `'session_'`, `'turn_'`, `'evt_'` |
| API 内部常量值 | `'function'`（OpenAI tool type） |
| 流事件类型 | `'text-start'`, `'text-end'`, `'done'` |

这些字符串应在对应包的 `constants.ts` 中定义为命名常量：

```typescript
// packages/provider/src/openai/constants.ts — ✅ 正确
export const API = {
  DEFAULT_BASE_URL: 'https://api.openai.com/v1',
  CHAT_PATH: '/chat/completions',
  METHOD: 'POST',
  HEADER_CONTENT_TYPE: 'application/json',
  AUTH_SCHEME: 'Bearer',
  SSE_DATA_PREFIX: 'data: ',
  SSE_DONE_SENTINEL: '[DONE]',
  TOOL_TYPE: 'function',
} as const

export const OPENAI_ROLES = {
  SYSTEM: 'system', USER: 'user', ASSISTANT: 'assistant', TOOL: 'tool',
} as const
```

```typescript
// 引用处 — ✅ 正确
Authorization: `${API.AUTH_SCHEME} ${this.apiKey}`
result.push({ role: OPENAI_ROLES.ASSISTANT, content: text?.text ?? null })
```

```typescript
// — ❌ 错误：裸字符串散落在业务逻辑中
result.push({ role: 'assistant', content: text?.text ?? null })
Authorization: `Bearer ${this.apiKey}`
```

> **判断准则**：如果一个字符串代表一条**业务语义**（即使只在当前包内），它就是命名常量的候选。如果它只是算法中的通用字符（如 `'\n'`、`' '`、`''`），可以不抽象。

---

## 5. 注释规范 (Commenting Standards)

### 5.1 注释的目的

注释应当解释**为什么要这样做**，而不是**做了什么**。代码本身应当能表达"做了什么"。

### 5.2 必须注释的地方

| 位置 | 注释内容 |
|------|---------|
| 每个文件顶部 | 文件职责（一句话） |
| 每个 class / 构造函数 | 类的职责、适用场景 |
| 每个 export function | 函数做什么、参数含义、返回值 |
| 每个 interface / type（非明显） | 类型的用途 |
| 非显而易见的算法逻辑 | 算法思路，而非逐行翻译 |
| 边界条件或 hack | 为什么需要特殊处理 |
| 常量/配置文件 | 每个导出的常量的用途 |

### 5.3 不应注释的地方

- **不注释显而易见的代码**：`i++; // i 加一`
- **不注释 Getter/Setter**：`getName() { return this.name } // 返回 name`
- **不注释类型定义中的每个字段**（除非字段用途不直观）

### 5.4 注释风格

```typescript
// JSDoc 风格的块注释 — 用于 class、public 函数、接口
/** 将 Crai Message[] 转为 OpenAI API 请求体中的 messages 数组。 */
function toOpenAIMessages(contextMessages: Message[], system?: string): OpenAIMessage[]

// 行注释 — 用于解释非显而易见的逻辑
// 跳过解析失败的 chunk（偶发的非 JSON SSE 行）
} catch {
  continue
}

// 节注释 — 用于在长文件中分隔逻辑块
// ============================================================
// Mock 模型工厂
// ============================================================
```

### 5.5 文件头部注释

每个源文件顶部应有一行简明的职责描述：

```typescript
/**
 * OpenAI ModelAdapter 实现。
 * 支持完整响应和 SSE 流式响应，自动在 Crai Message 与 OpenAI API 格式间双向转换。
 */
```

```typescript
// Mock 模型工厂 — 用于隔离测试，不依赖真实网络
```

### 5.6 注释与代码同步

注释是代码的一部分，修改代码时必须同步更新相邻的注释。特别是：
- 函数签名变化时更新 JSDoc
- 逻辑变化时更新关联的行注释
- 节注释与文件结构调整同步
