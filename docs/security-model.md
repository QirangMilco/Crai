# Crai 安全模型

## 1. 设计目标

- 从架构层面杜绝 agent 误操作导致灾难性后果（如删除硬盘中所有文件）的可能性
- 纵深防御：单一层面的防护失效不应导致失控
- 默认安全：即使没有配置任何安全策略，dangerous 级操作也被自动拒绝
- 分层可替换：每个安全防护层都可以独立替换或升级，不影响其余层

## 2. 四层防御体系

```txt
App/Transport 层     权限确认交互（confirm dialog / permission panel）
      ↑
Extension 层             默认危险命令列表、权限策略适配器、OS 级沙箱
      ↑
Runtime 层           工具安全检查门、路径沙箱校验、权限模式切换
      ↑
Core 层              安全类型契约（ToolSafetyLevel / PermissionMode / SandboxScope）
```

### 2.1 Core 层 — 安全类型定义

Core 层只定义安全契约，不实现任何安全逻辑：

- `ToolSafetyLevel`：每个 `ToolDefinition` 必须声明自身是 `safe` / `restricted` / `dangerous`
- `PermissionMode`：运行时当前的安全模式 `safe` / `ask` / `execute`
- `SandboxScope`：文件系统沙箱的作用域定义（rootDir、允许/禁止路径）
- `PermissionAdapter`：权限检查的抽象接口

### 2.2 Runtime 层 — 安全检查执行

Runtime 层在工具执行路径上强制执行安全检查：

- **工具安全检查门（Tool safety gate）**：在 `tool:before` hook 之后、实际执行工具之前，检查工具的 `safetyLevel` 与当前 `PermissionMode` 是否匹配
- **路径沙箱校验**：对于带文件路径参数的工具，校验目标路径是否在 `SandboxScope.rootDir` 范围内
- **事件广播**：工具被拒绝时发出 `tool.blocked` 事件，权限被请求时发出 `permission.requested` 事件

### 2.3 Extension 层 — 默认策略

预设扩展包提供可替换的默认安全策略：

- `Extension` 层：危险命令列表、危险命令正则匹配器、`PermissionAdapter` 实现由用户自行提供或从示例参考
- Extension：可自定义权限策略，覆盖默认行为

### 2.4 App/Transport 层 — 交互呈现

应用层负责权限确认的用户交互：

- CLI 传输层：标准输入确认提示
- Web 传输层：确认对话框 / permission panel
- IM 传输层：卡片式确认消息

## 3. 工具分类与安全级别

| 安全级别 | 含义 | 示例工具 | safe 模式 | ask 模式 | execute 模式 |
|----------|------|----------|-----------|----------|--------------|
| `safe` | 纯只读，不修改任何状态 | read_file, search, grep, list | 自动允许 | 自动允许 | 自动允许 |
| `restricted` | 受限写，仅在沙箱范围内生效 | edit_file, write_file, create | 拒绝 | 需确认 | 自动允许 |
| `dangerous` | 可能造成不可逆损害 | rm, shell, sudo, mv, chmod | 拒绝 | 需确认 | 敏感命令需确认，非敏感自动允许 |

## 4. 默认禁止的行为

以下操作默认在任何权限模式下都需要用户显式确认：

### 4.1 文件系统销毁
- `rm -rf /` 或任何根目录递归删除
- `rmdir` 删除目录
- `dd` 磁盘直接写入
- `mkfs` / `fdisk` / `parted` 格式化磁盘
- `> /dev/sda` 写入块设备

### 4.2 权限与系统变更
- `chmod` / `chown` / `chgrp` 修改文件权限
- `sudo` / `su` 提权操作
- `reboot` / `shutdown` / `halt` / `poweroff` 系统管理

### 4.3 进程管理
- `kill` / `killall` / `pkill` 终止进程（特别是针对自身进程）
- 任何终止 Node.js 进程的操作（参见自毁命令检测）

### 4.4 网络危险操作
- `curl ... | bash` / `wget -O - | sh` 管道执行远程脚本
- `ssh` / `scp` / `rsync` 远程连接与传输

## 5. 文件系统沙箱

### 5.1 核心机制

```
请求路径 → 路径归一化 → rootDir 前缀校验 → 路径遍历检测 → 允许/禁止列表检查 → 通过/拒绝
```

### 5.2 设计要点

- **rootDir 强制**：所有文件系统操作必须限定在 `sandbox.rootDir` 范围内
- **路径遍历检测**：使用 `path.relative()` 检测 `..` 逃逸，参考 reasonix 的 `safePath` 实现
- **读写分离控制**：允许列表（allowWrite）和禁止列表（denyWrite / denyRead）分别控制
- **字节上限**：`maxReadBytes` 防止读取超大文件导致 OOM

### 5.3 环境变量隔离

> **计划在 Phase 3 实现。** 以下为设计目标。

子进程执行时，以下环境变量默认被屏蔽，防止凭据泄露：

```
ANTHROPIC_API_KEY, OPENAI_API_KEY, AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY, GITHUB_TOKEN, GH_TOKEN, GOOGLE_API_KEY,
STRIPE_SECRET_KEY, NPM_TOKEN, CLAUDE_CODE_OAUTH_TOKEN
```

## 6. 扩展权限声明模型

每个扩展在 `setup` 之前可以声明其所需的权限：

```ts
export interface ExtensionPermissionDeclaration {
  kind: 'tool' | 'transport' | 'storage' | 'custom'
  action: string
  payload?: unknown
}
```

Runtime 在启动时（`bootstrapRuntimeExtensions`）评估这些声明：
- 如果扩展要求的权限被拒绝，扩展加载失败并返回错误
- 如果扩展要求的权限需要用户确认，发出 `permission.requested` 事件

## 7. 权限确认的交互流程

```txt
Agent 调用工具 → turnRunner 接收工具请求
  → 检查工具 safetyLevel
  → 对比当前 PermissionMode
  → 如果需要确认：
    → 发出 permission.requested 事件
    → App/Transport 层展示确认 UI
    → 用户选择允许/拒绝/始终允许
    → 发出 permission.resolved 事件
  → 如果拒绝：
    → 发出 tool.blocked 事件
    → 返回错误给 Agent
  → 如果允许：
    → 执行工具
    → 发出 tool.completed 事件
```

## 8. 与参考项目的关系

Crai 的安全模型综合以下参考项目的最佳实践：

| 机制 | 来源项目 |
|------|----------|
| 三级权限模式（safe/ask/execute） | CrystalAgents |
| 危险命令黑名单（DANGEROUS_COMMANDS） | CrystalAgents |
| 文件系统沙箱（rootDir + safePath） | reasonix |
| 读写字节上限（maxReadBytes） | reasonix |
| 自毁命令检测（isSelfDestructiveCommand） | snow-cli |
| 危险命令正则模式（DANGEROUS_PATTERNS） | snow-cli |
| 扩展级安全门（permission-gate） | pi-mono |
| OS 级沙箱（sandbox-exec / bubblewrap） | pi-mono |
| 中断/恢复机制（interrupt/resume） | eino |

## 9. 安全审计清单

在 Code Review 中应检查以下安全要点：

- [ ] 所有 `ToolDefinition` 是否都声明了 `safetyLevel`
- [ ] 新注册的工具是否遵循最小权限原则
- [ ] 危险命令列表是否覆盖了新增的工具
- [ ] 文件路径参数是否经过沙箱校验
- [ ] 子进程环境变量是否经过清洗
- [ ] 扩展是否声明了所需权限
- [ ] `permission:check` hook 是否被正确注册
