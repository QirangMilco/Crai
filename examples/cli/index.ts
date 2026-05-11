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
import type { Extension, ToolExecutionResult } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import { resolve } from 'node:path'

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
// 通过 AI_PROVIDER=openai|deepseek 显式选择，未指定时默认 openai
const PROVIDER = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
if (PROVIDER !== 'openai' && PROVIDER !== 'deepseek') {
  console.error('AI_PROVIDER 只能是 openai 或 deepseek')
  process.exit(1)
}
const providerOptions = { apiKey: API_KEY!, models: MODEL ? [MODEL] : undefined, baseURL: BASE_URL }
const provider = PROVIDER === 'deepseek'
  ? createDeepSeekProvider(providerOptions)
  : createOpenAIProvider(providerOptions)

// ── 内置工具 ─────────────────────────────────────────
/** 校验路径在 workspace 范围内，返回标准化绝对路径。
 *  \$resolve('proj', '../etc') 解析到 proj 之外 → 拒绝
 *  resolve('proj', '/etc') 绝对路径覆盖 → 拒绝
 */
function resolveAllowedPath(inputPath: string, rootDir: string): string {
  const normalizedRoot = resolve(rootDir)
  const resolved = resolve(normalizedRoot, inputPath)
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`路径拒绝: ${inputPath} 不在工作区内`)
  }
  return resolved
}

function createBuiltinTools(): Extension {
  return {
    name: 'cli:builtin-tools',
    setup(ctx) {
      const rootDir = process.cwd()

      ctx.registerTool({
        name: 'read_file',
        description: '读取文件内容',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径' } }, required: ['path'] },
        safetyLevel: 'safe' as any,
        execute: async (request) => {
          try {
            const { path } = request.toolCall.arguments as any
            const { readFile } = await import('node:fs/promises')
            const allowedPath = resolveAllowedPath(path, rootDir)
            const content = await readFile(allowedPath, 'utf-8')
            return { toolCallId: request.toolCall.toolCallId, name: 'read_file', content: [{ type: 'text', text: content }] }
          } catch (err: any) {
            return { toolCallId: request.toolCall.toolCallId, name: 'read_file', isError: true, content: [{ type: 'text', text: `读取失败: ${err.message}` }] }
          }
        },
      })

      ctx.registerTool({
        name: 'grep',
        description: '在文件中搜索文本',
        inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: '搜索模式' }, path: { type: 'string', description: '搜索路径（可选，默认当前目录）' } }, required: ['pattern'] },
        safetyLevel: 'safe' as any,
        execute: async (request) => {
          try {
            const { pattern, path } = request.toolCall.arguments as any
            const { spawnSync } = await import('node:child_process')
            const searchPath = path ? resolveAllowedPath(path, rootDir) : rootDir
            const result = spawnSync('grep', ['-rn', pattern, searchPath], {
              encoding: 'utf-8',
              maxBuffer: 1024 * 1024,
              timeout: 10_000,
            })
            const output = result.stdout?.trim() || result.stderr?.trim() || ''
            return { toolCallId: request.toolCall.toolCallId, name: 'grep', content: [{ type: 'text', text: output || '(无匹配)' }] }
          } catch (err: any) {
            return { toolCallId: request.toolCall.toolCallId, name: 'grep', isError: true, content: [{ type: 'text', text: `搜索失败: ${err.message}` }] }
          }
        },
      })

      // bash 工具需要 PermissionAdapter 支持才能安全使用，暂不添加
    },
  }
}

// ── 启动 ─────────────────────────────────────────────
async function main() {
  const runtime = await createRuntime({
    extensions: [
      provider,
      createFileStorage({ baseDir: STORAGE_DIR }),
      createPersistenceExtension(),
      createBuiltinTools(),
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
    await runtime.dispose()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
