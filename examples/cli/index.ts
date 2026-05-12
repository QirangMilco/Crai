/**
 * Crai CLI 入口。
 *
 * 启动一个交互式 REPL，支持多轮对话和工具调用。
 *
 * 使用方法：
 *   export AI_API_KEY=sk-xxx           # provider API key
 *   export AI_PROVIDER=openai|deepseek # provider 类型（默认 openai）
 *   export AI_BASE_URL=https://...     # provider base URL（可选）
 *   export AI_MODEL=<model>             # 模型名（可选）
 *   export AI_STORAGE_DIR=.crai/data    # 持久化目录（可选）
 *   export AI_SESSION_FILE=.crai/session # session ID 持久化文件（可选）
 *   pnpm cli
 */
import { createRuntime } from '@crai/runtime'
import { createOpenAIProvider, createDeepSeekProvider } from '@crai/provider'
import { createFileStorage } from '@crai/storage-fs'
import { createPersistenceExtension } from '@crai/persistence'
import { createCliRepl } from '@crai/cli-repl'
import { createWorkspaceSecurity } from '@crai/security'
import { createFsTools } from '@crai/tools-fs'
import { createShellTools, processManager } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createInterface } from 'node:readline/promises'
import { resolve, dirname } from 'node:path'

// ── 配置 ─────────────────────────────────────────────
const API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY
const BASE_URL = process.env.AI_BASE_URL
const MODEL = process.env.AI_MODEL
const STORAGE_DIR = process.env.AI_STORAGE_DIR ?? '.crai/cli-data'
const SESSION_FILE = process.env.AI_SESSION_FILE ?? '.crai/cli-session'
const AI_TRACE = process.env.AI_TRACE ?? ''
const TRACE_OPTION =
  AI_TRACE === 'file' ? 'file'
  : AI_TRACE === 'realtime' ? 'realtime'
  : AI_TRACE === 'console' ? 'console'
  : AI_TRACE === '1' || AI_TRACE === 'true' ? true
  : undefined

if (!API_KEY) {
  console.error('请设置 AI_API_KEY 环境变量')
  process.exit(1)
}

// ── Provider ─────────────────────────────────────────
const PROVIDER = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
if (PROVIDER !== 'openai' && PROVIDER !== 'deepseek') {
  console.error('AI_PROVIDER 只能是 openai 或 deepseek')
  process.exit(1)
}
const providerOptions = { apiKey: API_KEY!, models: MODEL ? [MODEL] : undefined, baseURL: BASE_URL }
const provider = PROVIDER === 'deepseek'
  ? createDeepSeekProvider(providerOptions)
  : createOpenAIProvider(providerOptions)

// ── CLI 确认回调 ───────────────────────────────────
// 全局唯一的 readline 实例（传给 cli-repl 和工具交互，避免双回显）
const rl = createInterface({ input: process.stdin, output: process.stdout })
const sessionApprovedTools = new Set<string>()

// 工具执行中用户提问的回调（如 fs_write 询问是否覆盖）
function createCliUserInput() {
  return async (question: string, options?: string[]): Promise<string> => {
    const prompt = options?.length
      ? `\n${question}\n${options.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}\n请选择 (1-${options.length}): `
      : `\n${question}: `
    const answer = await rl.question(prompt)
    return answer.trim()
  }
}

function createCliAskHandler() {
  return async (request: { toolName: string; args: Record<string, unknown>; reason: string; isSensitive?: boolean }): Promise<boolean> => {
    // 会话内已批准 & 非敏感命令，跳过确认
    if (sessionApprovedTools.has(request.toolName) && !request.isSensitive) return true

    const argStr = JSON.stringify(request.args, null, 2)
    console.log('\n\u26A0\uFE0F  权限请求: 工具 ' + request.toolName + (request.isSensitive ? ' (敏感命令)' : ''))
    console.log('参数: ' + argStr)
    console.log('原因: ' + request.reason)
    const prompt = request.isSensitive
      ? '这是敏感命令，即使已设为始终允许也需确认。是否允许? (y/N) '
      : '是否允许? (y/N/a = 本次会话始终允许) '
    const answer = await rl.question(prompt)
    const lower = answer.toLowerCase()
    if (lower === 'a' || lower === 'always') {
      if (!request.isSensitive) {
        sessionApprovedTools.add(request.toolName)
        console.log('已允许，本次会话不再询问。')
      } else {
        console.log('已允许（敏感命令不可设为始终允许）。')
      }
      return true
    } else if (lower === 'y' || lower === 'yes') {
      console.log('已允许。')
      return true
    } else {
      console.log('已拒绝。')
      return false
    }
  }
}

// ── 启动 ─────────────────────────────────────────────
async function main() {
  const rootDir = process.cwd()
  const security = createWorkspaceSecurity({
    rootDir,
    mode: 'ask',
    askHandler: createCliAskHandler(),
  })

  runtime = await createRuntime({
    extensions: [
      provider,
      createFileStorage({ baseDir: STORAGE_DIR }),
      createPersistenceExtension(),
      createFsTools({ rootDir, snapshotsDir: resolve(dirname(STORAGE_DIR), 'snapshots') }),
      createShellTools({ rootDir }),
      createWebTools(),
      security,
    ],
    trace: TRACE_OPTION,
    requestUserInput: createCliUserInput(),
  })

  try {
    await createCliRepl(runtime, {
      model: MODEL,
      showBanner: true,
      sessionFile: SESSION_FILE,
      readline: rl,
    })
  } finally {
    // 清理子进程，关闭 readline
    processManager.killAll()
    rl.close()
    // runtime.dispose 会触发 extension dispose
    if (runtime) await runtime.dispose()
  }
}

// SIGINT / SIGTERM：先清理再退出
process.on('SIGINT', () => { processManager.killAll(); process.exit(0) })
process.on('SIGTERM', () => { processManager.killAll(); process.exit(0) })

// 保存当前 runtime 引用
let runtime: Awaited<ReturnType<typeof createRuntime>>

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
