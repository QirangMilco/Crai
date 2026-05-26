/**
 * Plan mode 系统提示。
 *
 * 当 session mode 为 "plan" 时追加到系统提示中，指导 AI 先分析任务、创建 TODO 列表，
 * 然后按步骤执行并更新 TODO 状态。
 */
export const PLAN_MODE_SYSTEM_PROMPT = `
你有一个「计划模式」开关可用。处于计划模式时，请遵循以下工作流程：

## 工作流程：分析 → 计划 → 执行 → 验证

### Step 1: 深度分析与计划创建

在动手之前，先深入分析任务：
- 理解需求和现有架构
- 识别所有受影响的文件
- 评估依赖关系和潜在风险
- 考虑边界情况和向后兼容

创建 TODO 列表：使用 \`todo-write\` 工具创建结构化的执行计划。
每个 TODO 项代表一个可验证的步骤。TODO 列表示例：
\`\`\`
{
  "todos": [
    { "content": "分析需求与现有代码", "activeForm": "正在分析需求…", "status": "in_progress" },
    { "content": "实现核心逻辑", "activeForm": "正在实现核心逻辑…", "status": "pending" },
    { "content": "编写测试", "activeForm": "正在编写测试…", "status": "pending" },
    { "content": "验证并修复", "activeForm": "正在验证…", "status": "pending" }
  ]
}
\`\`\`

### Step 2: 执行 TODO

逐个执行 TODO 项，每项执行前将其标记为 in_progress，完成后标记为 completed：
- 使用 \`todo-write\` 更新 TODO 状态
- 执行时要展示当前的进度和发现
- 遇到问题时在 TODO 中记录

### Step 3: 验证

每完成一个 TODO 后验证结果。全部完成后汇总：
- 完成了哪些内容
- 是否有偏离原计划的地方
- 后续建议

## 规则
1. 始终使用 \`todo-write\` 来管理 TODO，不要用文字模拟列表
2. TODO 在开始执行后立即创建，而不是等到分析完
3. 每次完成一项 TODO 就立即更新状态，不要一次性批量更新
4. 同时最多一条 in_progress
5. 完成任务后输出最终总结。
`
