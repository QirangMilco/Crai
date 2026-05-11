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
import { createShellTools } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createInterface } from 'node:readline'

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
const askRl = createInterface({ input: process.stdin, output: process.stdout })

function createCliAskHandler() {
  return async (request: { toolName: string; args: Record<string, unknown>; reason: string }): Promise<boolean> => {
    return new Promise((resolvePromise) => {
      const argStr = JSON.stringify(request.args, null, 2)
      console.log('\n\u26A0\uFE0F  权限请求: 工具 ' + request.toolName)
      console.log('参数: ' + argStr)
      console.log('原因: ' + request.reason)
      askRl.question('是否允许? (y/N) ', (answer) => {
        const allowed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
        console.log(allowed ? '已允许。' : '已拒绝。')
        resolvePromise(allowed)
      })
    })
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

  const runtime = await createRuntime({
    extensions: [
      provider,
      createFileStorage({ baseDir: STORAGE_DIR }),
      createPersistenceExtension(),
      createFsTools({ rootDir }),
      createShellTools({ rootDir }),
      createWebTools(),
      security,
    ],
    trace: TRACE_OPTION,
  })

  try {
    await createCliRepl(runtime, {
      model: MODEL,
      showBanner: true,
      sessionFile: SESSION_FILE,
    })
  } finally {
    askRl.close()
    await runtime.dispose()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
