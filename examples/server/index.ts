/**
 * Crai Server 入口。
 *
 * 启动 runtime 后通过 WebSocket 暴露给 web GUI。
 * 与 examples/cli/index.ts 使用相同的 extension 配置。
 *
 * 使用方法：
 *   export AI_API_KEY=sk-xxx
 *   pnpm tsx examples/server/index.ts
 *   # 浏览器打开 http://localhost:5173
 */
import { createRuntime } from '@crai/runtime'
import { createOpenAIProvider, createDeepSeekProvider } from '@crai/provider'
import { createFileStorage } from '@crai/storage-fs'
import { createPersistenceExtension } from '@crai/persistence'
import { createWorkspaceSecurity } from '@crai/security'
import { createFsTools } from '@crai/tools-fs'
import { createShellTools, processManager } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createWsTransport } from '@crai/transport-ws'
import { resolve, dirname } from 'node:path'

// ── 配置 ─────────────────────────────────────────────
const WS_PORT = Number(process.env.CRAI_WS_PORT ?? '8080')
const API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY
const BASE_URL = process.env.AI_BASE_URL
const MODEL = process.env.AI_MODEL
const STORAGE_DIR = process.env.AI_STORAGE_DIR ?? '.crai/data'

if (!API_KEY) {
  console.error('请设置 AI_API_KEY 环境变量')
  process.exit(1)
}

const PROVIDER = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
const providerOptions = { apiKey: API_KEY!, models: MODEL ? [MODEL] : undefined, baseURL: BASE_URL }
const provider = PROVIDER === 'deepseek'
  ? createDeepSeekProvider(providerOptions)
  : createOpenAIProvider(providerOptions)

// ── 启动 ──
async function main() {
  const rootDir = process.cwd()

  const wsTransport = createWsTransport({ port: WS_PORT })

  const security = createWorkspaceSecurity({
    rootDir,
    mode: 'ask',
    askHandler: async () => true, // 通过 WS 确认（暂放行）
  })

  const runtime = await createRuntime({
    extensions: [
      provider,
      createFileStorage({ baseDir: STORAGE_DIR }),
      createPersistenceExtension(),
      createFsTools({ rootDir, snapshotsDir: resolve(dirname(STORAGE_DIR), 'snapshots') }),
      createShellTools({ rootDir }),
      createWebTools(),
      security,
      wsTransport.extension,
    ],
    requestUserInput: wsTransport.requestUserInput,
  })

  const { url } = await wsTransport.start()
  console.log(`\n  Crai runtime 已启动`)
  console.log(`  WebSocket: ${url}`)
  console.log(`  Web UI:    http://localhost:5173\n`)

  process.on('SIGINT', async () => {
    console.log('\n正在关闭…')
    await wsTransport.stop()
    processManager.killAll()
    await runtime.dispose()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
