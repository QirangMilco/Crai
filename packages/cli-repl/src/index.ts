/**
 * @crai/cli-repl — 交互式 CLI REPL。
 *
 * 创建一个 readline 循环，将用户输入转为 runtime prompt 调用。
 * 输出通过 stream display extension 实时写入 stdout。
 *
 * 用法：
 *   import { createCliRepl } from '@crai/transport-cli'
 *   import { createRuntime } from '@crai/runtime'
 *   const runtime = await createRuntime({ extensions: [...] })
 *   await createCliRepl(runtime)
 */
import type { RuntimeHandle, Extension } from '@crai/core'
import { EVENTS } from '@crai/core'
import { createInterface } from 'node:readline/promises'

const BANNER = [
  '╔══════════════════════════════╗',
  '║  Crai CLI — type /help      ║',
  '║  /quit to exit, /session new ║',
  '╚══════════════════════════════╝',
  '',
]

const HELP_TEXT = [
  'Available commands:',
  '  /help          — show this help',
  '  /quit or /exit — exit',
  '  /session new   — start a new session',
  '  /model <name>  — switch model',
  '  /session id    — show current session ID',
  '',
  'Otherwise, type anything and press Enter to chat.',
]

/** 创建一个流式输出的 display extension。 */
function createStreamDisplay(): Extension {
  return {
    name: 'transport-cli:stream-display',
    setup(ctx) {
      ctx.events.on(EVENTS.MODEL_DELTA, (event: any) => {
        process.stdout.write(event.payload.delta)
      })
    },
  }
}

export interface CliReplOptions {
  /** 默认模型名。未指定时使用 runtime 的第一个注册模型。 */
  model?: string
  /** 启动时的 system prompt 元数据。 */
  system?: string
  /** 是否在启动时显示 banner。默认 true。 */
  showBanner?: boolean
  /**
   * 会话 ID 持久化文件路径。
   * 文件存在时尝试恢复该 session（消息历史从 storage 中加载）。
   * 不存在时创建新 session 并写入该文件。
   * 设置为 false 可禁用持久化。
   */
  sessionFile?: string | false
}

/**
 * 启动交互式 CLI REPL。
 *
 * 创建一个 readline 循环，将每行输入作为 text prompt 发送到 runtime。
 * 实时流式输出模型回复。
 *
 * 返回 Promise，用户输入 /quit 或 Ctrl+C 时 resolve。
 */
export async function createCliRepl(
  runtime: RuntimeHandle,
  options: CliReplOptions = {},
): Promise<void> {
  const showBanner = options.showBanner !== false
  if (showBanner) {
    for (const line of BANNER) console.log(line)
  }

  // 注册 stream display extension
  await runtime.loadExtension(createStreamDisplay())

  // ── session 恢复 / 创建 ──
  const systemMeta = options.system ? { system: options.system } : undefined

  // 尝试从文件恢复 session ID
  let restoredId: string | undefined
  if (options.sessionFile) {
    try {
      const { readFile } = await import('node:fs/promises')
      const saved = await readFile(options.sessionFile, 'utf-8').catch(() => '')
      restoredId = saved.trim() || undefined
    } catch {
      // 读取出错静默降级
    }
  }

  let session = await runtime.createSession(
    systemMeta,
    restoredId, // 有恢复 ID 就用，没有则 runtime 生成新 ID
  )

  if (restoredId) {
    console.log(`Resumed session: ${session.id}`)
  } else if (options.sessionFile) {
    // 新创建的 session 保存 ID
    try {
      const { writeFile, mkdir } = await import('node:fs/promises')
      const { dirname } = await import('node:path')
      await mkdir(dirname(options.sessionFile), { recursive: true }).catch(() => {})
      await writeFile(options.sessionFile, session.id, 'utf-8')
    } catch {
      // 写入失败不阻塞
    }
  }

  let currentModel = options.model

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  })

  // 捕获 SIGINT（Ctrl+C）
  const onSigint = () => {
    console.log('\nUse /quit to exit.')
    rl.prompt()
  }
  process.on('SIGINT', onSigint)

  try {
    rl.prompt()

    for await (const line of rl) {
      const trimmed = line.trim()

      if (!trimmed) {
        rl.prompt()
        continue
      }

      // ── 命令处理 ──
      if (trimmed.startsWith('/')) {
        const parts = trimmed.slice(1).split(/\s+/)
        const cmd = parts[0]
        const args = parts.slice(1)

        switch (cmd) {
          case 'quit':
          case 'exit':
            break

          case 'help':
            for (const h of HELP_TEXT) console.log(h)
            rl.prompt()
            continue

          case 'session':
            if (args[0] === 'new') {
              await runtime.stopSession(session.id)
              session = await runtime.createSession(systemMeta)
              if (options.sessionFile) {
                try {
                  const { writeFile, mkdir } = await import('node:fs/promises')
                  const { dirname } = await import('node:path')
                  await mkdir(dirname(options.sessionFile), { recursive: true }).catch(() => {})
                  await writeFile(options.sessionFile, session.id, 'utf-8')
                } catch {}
              }
              console.log(`New session started: ${session.id}`)
            } else if (args[0] === 'id') {
              console.log(`Session ID: ${session.id}`)
            } else {
              console.log('Usage: /session new | id')
            }
            rl.prompt()
            continue

          case 'model':
            if (args[0]) {
              currentModel = args[0]
              console.log(`Switched to model: ${currentModel}`)
            } else {
              console.log('Usage: /model <name>')
            }
            rl.prompt()
            continue

          default:
            console.log(`Unknown command: /${cmd}. Type /help for available commands.`)
            rl.prompt()
            continue
        }
        break // /quit /exit
      }

      // ── prompt ──
      process.stdout.write('\n')
      try {
        await runtime.prompt(
          { type: 'text', text: trimmed },
          { sessionId: session.id, model: currentModel },
        )
      } catch (err: any) {
        console.error(`\n[error] ${err.message ?? err}`)
      }
      console.log() // 换行
      rl.prompt()
    }
  } finally {
    process.off('SIGINT', onSigint)
    await runtime.stopSession(session.id)
    await rl.close()
    console.log()
  }
}
