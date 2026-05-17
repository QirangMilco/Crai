#!/usr/bin/env node

/**
 * Crai WS 协议测试脚本。
 *
 * 连接到 Crai server 的 WS，自动执行测试场景，
 * 输出原始事件流 + 消息结构分析。不依赖浏览器。
 *
 * 用法：
 *   cd /Users/qirang/Documents/Projects/Crai
 *   pnpm install                  # 首次需安装 ws 依赖
 *   node scripts/ws-test.mjs
 *
 * 输出保存到 ws-test-{时间戳}.log，可以直接粘贴给我。
 */

import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── 配置 ───────────────────────────────────────────

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '8080')
const HOST = process.argv.find(a => a.startsWith('--host='))?.split('=')[1] || 'localhost'
const URL = `ws://${HOST}:${PORT}`
const LOG_FILE = resolve(`ws-test-${Date.now()}.log`)

// ── 日志 ───────────────────────────────────────────

let logLines = []

function log(prefix, ...args) {
  const line = `[${prefix}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`
  logLines.push(line)
  console.log(line)
}

function pass(prefix, msg) {
  log(prefix, `✅ ${msg}`)
}

function fail(prefix, msg) {
  log(prefix, `❌ ${msg}`)
}

// ── 消息结构重建（模拟客户端 upsert 逻辑） ─────────

function reconstructBlocks(events) {
  const thinkingBlocks = []
  let currentThinking = null
  const toolGroups = []
  let currentToolGroup = { tools: [], running: 0, done: 0 }
  let textBlock = null

  for (const e of events) {
    if (e.event === 'thinking.delta') {
      if (!currentThinking || currentThinking.sealed) {
        currentThinking = { content: '', sealed: false }
        thinkingBlocks.push(currentThinking)
      }
      currentThinking.content += e.payload.delta || ''
    } else if (e.event === 'thinking.done') {
      if (currentThinking && !currentThinking.sealed) {
        currentThinking.sealed = true
      }
    } else if (e.event === 'tool.start') {
      const t = {
        toolCallId: e.payload.toolCallId,
        name: e.payload.name,
        detail: extractDetail(e.payload.name, e.payload.args),
        status: 'running',
      }
      currentToolGroup.tools.push(t)
      currentToolGroup.running++
    } else if (e.event === 'tool.done') {
      const found = currentToolGroup.tools.find(t => t.toolCallId === e.payload.toolCallId && t.status === 'running')
      if (found) {
        found.status = 'done'
        currentToolGroup.running--
        currentToolGroup.done++
      } else {
        // 没找到 → 可能是新 round 的 tool_group
        // 简化：创建新 group 并添加
        const t = {
          toolCallId: e.payload.toolCallId,
          name: e.payload.name,
          detail: extractDetail(e.payload.name, e.payload.args),
          status: 'done',
        }
        if (currentToolGroup.tools.length > 0) {
          toolGroups.push(currentToolGroup)
        }
        currentToolGroup = { tools: [t], running: 0, done: 1 }
      }
    } else if (e.event === 'model.delta') {
      if (!textBlock) textBlock = { content: '' }
      textBlock.content += e.payload.delta || ''
    }
  }

  // 封尾
  if (currentToolGroup.tools.length > 0) toolGroups.push(currentToolGroup)

  const blocks = []
  // 按事件原始顺序重建 blocks 列表
  for (const tb of thinkingBlocks) {
    blocks.push({ type: 'thinking', contentLength: tb.content.length, sealed: tb.sealed })
  }
  for (const tg of toolGroups) {
    blocks.push({
      type: 'tool_group',
      toolCount: tg.tools.length,
      running: tg.running,
      done: tg.done,
      tools: tg.tools.map(t => `${t.status === 'done' ? '✓' : '⏳'} ${t.name}[${t.toolCallId.slice(0, 12)}]${t.detail ? ' ' + t.detail : ''}`),
    })
  }
  if (textBlock) {
    blocks.push({ type: 'text', contentLength: textBlock.content.length })
  }

  return blocks
}

function extractDetail(name, args) {
  if (!args) return ''
  try {
    const parsed = typeof args === 'string' ? JSON.parse(args) : args
    if (name === 'fs_list' && parsed.path) return parsed.path
    if (name === 'fs_read' && parsed.path) return parsed.path
    if (name === 'fs_write' && parsed.path) return parsed.path
    if (name === 'fs_edit' && parsed.path) return parsed.path
    if (name === 'bash' && parsed.command) return parsed.command.substring(0, 60)
    if (name === 'web_search' && parsed.query) return parsed.query
    if (name === 'web_fetch' && parsed.url) return parsed.url
  } catch {}
  return ''
}

// ── 异常检测 ───────────────────────────────────────

function analyze(events, label) {
  log('', '')
  log('📊', `=== ${label} ===`)
  log('', '')

  const anomalies = []

  // 1. 事件概览
  const counts = {}
  let totalPayloadSize = 0
  for (const e of events) {
    counts[e.event] = (counts[e.event] || 0) + 1
    totalPayloadSize += JSON.stringify(e.payload || {}).length
  }
  log('ℹ️', `事件总数: ${events.length} (${totalPayloadSize}B)`)

  for (const [evt, cnt] of Object.entries(counts)) {
    let label = evt
    // 添加人类可读注释
    if (evt === 'thinking.delta') label += ` (${events.filter(e => e.event === evt).map(e => e.payload.delta).join('')})`
    if (evt === 'thinking.done') label += ` (封口)`
    log('   ', `  ${cnt}x ${label}`)
  }

  // 2. 重建 blocks 并检测异常
  const blocks = reconstructBlocks(events)
  log('📦', `消息 blocks (${blocks.length}个):`)
  for (const b of blocks) {
    if (b.type === 'thinking') log('   ', `  💭 thinking(${b.contentLength}ch, sealed=${b.sealed})`)
    else if (b.type === 'tool_group') {
      const icons = b.tools.map(t => t[0]).join('')
      log('   ', `  🔧 tool_group(${b.toolCount}个工具, ${b.done}完成, ${b.running}运行中) ${icons}`)
      for (const t of b.tools) log('   ', `       ${t}`)
    }
    else if (b.type === 'text') log('   ', `  📝 text(${b.contentLength}ch)`)
  }

  // 3. 异常检查

  // a. 工具未完成
  const runningTools = blocks.filter(b => b.type === 'tool_group' && b.running > 0)
  if (runningTools.length > 0) anomalies.push(`还有 ${runningTools.reduce((s, b) => s + b.running, 0)} 个工具未完成`)

  // b. 重复封口
  const thinkingDoneCount = events.filter(e => e.event === 'thinking.done').length
  if (thinkingDoneCount > 0) {
    const deltaCount = events.filter(e => e.event === 'thinking.delta').length
    if (deltaCount === 0) anomalies.push(`有 thinking.done 但没有 thinking.delta`)
    if (deltaCount < 3 && thinkingDoneCount > 1) anomalies.push(`只有 ${deltaCount} 个 thinking.delta 就有 ${thinkingDoneCount} 个封口`)
  }

  // c. thinking 块异常
  const allThinking = blocks.filter(b => b.type === 'thinking')
  if (allThinking.length > 1) {
    const unsealed = allThinking.filter(b => !b.sealed)
    if (unsealed.length > 1) anomalies.push(`有 ${unsealed.length} 个未封口的 thinking block`)
    log('💡', `多轮 thinking (${allThinking.length} 轮)，这是正常的`)
  }

  // d. 检查 thinking 内容首尾
  const thinkingContent = events.filter(e => e.event === 'thinking.delta').map(e => e.payload.delta).join('')
  if (thinkingContent.length > 0) {
    log('💭', `思考内容 (${thinkingContent.length}ch): "${thinkingContent}"`)
    // 检查首字重复的痕迹
    if (thinkingContent.length >= 2 && thinkingContent[0] === thinkingContent[1]) {
      anomalies.push(`思考首字重复: "${thinkingContent.slice(0, 6)}..."`)
    }
  }

  // e. 检查文本内容首尾
  const textContent = events.filter(e => e.event === 'model.delta').map(e => e.payload.delta).join('')
  if (textContent.length > 0) {
    log('📝', `文本内容 (${textContent.length}ch): "${textContent.slice(0, 60)}${textContent.length > 60 ? '...' : ''}"`)
    if (textContent.length >= 2 && textContent[0] === textContent[1]) {
      anomalies.push(`文本首字重复: "${textContent.slice(0, 6)}..."`)
    }
  }

  // f. tool.done 数量 vs tool.start 数量
  const toolStarts = events.filter(e => e.event === 'tool.start').length
  const toolDones = events.filter(e => e.event === 'tool.done').length
  if (toolStarts !== toolDones) {
    anomalies.push(`tool.start(${toolStarts}) 和 tool.done(${toolDones}) 数量不一致`)
  }

  if (anomalies.length > 0) {
    fail('ANOMALY', `发现 ${anomalies.length} 个异常:`)
    for (const a of anomalies) fail('     ', `- ${a}`)
  } else {
    pass('ANOMALY', '未发现异常')
  }
  log('', '')
}

// ── 交互式选择 ─────────────────────────────────────

import { createInterface } from 'node:readline'

function ask(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(prompt, (a) => { rl.close(); resolve(a) }))
}

// ── 主流程 ─────────────────────────────────────────

async function main() {
  log('🚀', `连接 ${URL} ...`)

  const ws = new WebSocket(URL)

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
    setTimeout(() => reject(new Error('连接超时')), 5000)
  })
  pass('WS', `已连接 ${URL}`)

  // ── 事件队列 ──
  // 所有收到的消息按序存储
  const allMessages = []

  ws.on('message', (data) => {
    allMessages.push(data.toString())
  })

  // helper: 发送并等待某个事件
  function waitFor(typeFilter, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = allMessages.find(m => {
          try { const p = JSON.parse(m); return typeFilter(p) } catch { return false }
        })
        if (found) { resolve(JSON.parse(found)); return }
        setTimeout(check, 100)
      }
      setTimeout(() => reject(new Error(`waitFor timeout: ${typeFilter}`)), timeoutMs)
      check()
    })
  }

  function send(msg) {
    ws.send(JSON.stringify(msg))
  }

  function getMessage(idx) {
    if (idx < allMessages.length) return JSON.parse(allMessages[idx])
    return null
  }

  function messagesSince(idx) {
    return allMessages.slice(idx).map(m => JSON.parse(m))
  }

  function lastMessage() {
    return allMessages.length > 0 ? JSON.parse(allMessages[allMessages.length - 1]) : null
  }

  try {
    // 获取配置（需主动请求）
    pass('SETUP', '获取配置...')
    send({ type: 'config:get' })
    await waitFor(m => m.type === 'config:data')

    // ── 获取工作区列表 + 交互式选择 ──
    pass('SETUP', '获取工作区列表...')
    send({ type: 'workspace:list' })
    const wsList = await waitFor(m => m.type === 'workspace:list:data')
    const workspaces = wsList.workspaces || []
    if (workspaces.length === 0) {
      // 没有工作区：提示用户在 web UI 配好 provider 后再跑
      log('', '')
      log('⚠️', '='.repeat(60))
      log('⚠️', '没有可用的工作区。请先：')
      log('⚠️', '  1. 打开 http://localhost:5173')
      log('⚠️', '  2. 在配置面板中添加 provider（Mock 或 DeepSeek/OpenAI）')
      log('⚠️', '  3. 切换到任意工作区')
      log('⚠️', '  4. 再重新运行此脚本')
      log('⚠️', '='.repeat(60))
      log('', '')
      process.exit(0)
    }
    console.log('\n📂 可用的工作区:')
    for (let i = 0; i < workspaces.length; i++) {
      const cur = wsList.current === workspaces[i].rootDir ? ' ← 当前' : ''
      console.log(`  [${i + 1}] ${workspaces[i].rootDir}${cur}`)
    }
    const raw = await ask('\n请选择工作区编号: ')
    const idx = parseInt(raw.trim(), 10) - 1
    if (isNaN(idx) || idx < 0 || idx >= workspaces.length) {
      fail('SETUP', `无效选择: ${raw.trim()}`)
      process.exit(1)
    }
    const targetWs = workspaces[idx].rootDir
    console.log()  // 回到常规 log 输出
    pass('SETUP', `切换到工作区: ${targetWs}`)
    send({ type: 'workspace:switch', rootDir: targetWs })
    await waitFor(m => m.type === 'workspace:switched')

    // ── 创建 session ──
    pass('SETUP', '创建新 session...')
    send({ type: 'session:new' })
    await waitFor(m => m.type === 'session:id')
    const sidMsg = lastMessage()
    const sessionId = sidMsg.id
    pass('SETUP', `session: ${sessionId}`)

    // 获取初始数据
    send({ type: 'session:load', sessionId })
    await waitFor(m => m.type === 'session:data')

    // 记录当前消息索引，之后处理
    const beforePromptIdx = allMessages.length

    // ── 测试循环 ──

    const tests = [
      { prompt: '消息测试',   label: '基础测试（思考→3工具→文本→第二轮）' },
      { prompt: '复杂多轮测试', label: '复杂多轮测试（第一轮思考→2工具→第二轮）' },
      { prompt: '你好',         label: '简单文本回复' },
    ]

    for (const test of tests) {
      log('', '')
      log('='.repeat(70))
      log('🧪', `测试: "${test.prompt}" — ${test.label}`)
      log('='.repeat(70))

      const beforeIdx = allMessages.length

      // 每条测试新建 session，避免上下文干扰
      send({ type: 'session:new' })
      await waitFor(m => m.type === 'session:id')
      const sid = lastMessage().id
      send({ type: 'session:load', sessionId: sid })
      await waitFor(m => m.type === 'session:data')

      // 发送 prompt
      send({ type: 'prompt', text: test.prompt, model: 'mock', sessionId: sid })

      // 等待 model.completed，然后发 session:load 获取 session:data
      await new Promise((resolve, reject) => {
        let gotCompleted = false
        let gotData = false
        let timeout = setTimeout(() => reject(new Error(`测试 "${test.prompt}" 超时`)), 20000)

        const checker = setInterval(() => {
          const msgs = allMessages.slice(beforeIdx)
          for (const raw of msgs) {
            try {
              const m = JSON.parse(raw)
              // 收到 model.completed 后立即发 session:load 拉取持久化数据
              if (m.type === 'event' && m.event === 'model.completed' && !gotCompleted) {
                gotCompleted = true
                send({ type: 'session:load', sessionId: sid })
              }
              if (m.type === 'session:data' && gotCompleted) {
                gotData = true
                clearTimeout(timeout)
                clearInterval(checker)
                resolve()
              }
            } catch {}
          }
        }, 50)
      })

      // 提取本次测试的事件
      const rawMsgs = allMessages.slice(beforeIdx)
      const events = rawMsgs
        .map(m => JSON.parse(m))
        .filter(m => m.type === 'event')
        .map(m => ({ event: m.event, payload: m.payload }))

      // 分析
      analyze(events, `"${test.prompt}" 结果`)

      // 打印 session:data 详情
      const dataMsg = rawMsgs
        .map(m => JSON.parse(m))
        .find(m => m.type === 'session:data')
      if (dataMsg) {
        log('💾', `session:data → ${dataMsg.messages.length} 条消息`)
        for (const msg of dataMsg.messages) {
          const textPreview = msg.text ? msg.text.slice(0, 40) : '(空)'
          log('   ', `  [${msg.role}] ${textPreview}${msg.text && msg.text.length > 40 ? '...' : ''}`)
        }
      }
    }

    // ── 保存日志 ──
    writeFileSync(LOG_FILE, logLines.join('\n'), 'utf-8')
    log('💾', ``)
    log('💾', `日志已保存到 ${LOG_FILE}`)
    log('💾', `把文件内容粘贴给我，或者说 "日志在文件里" 让我读取`)

  } catch (err) {
    fail('FATAL', err.message)
    writeFileSync(LOG_FILE, logLines.join('\n'), 'utf-8')
    log('💾', `日志已保存到 ${LOG_FILE}`)
    process.exit(1)
  }

  ws.close()
}

main()
