/**
 * context-window.test.ts — 上下文窗口管理与压缩测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Message } from '@crai/core'
import {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  checkContext,
  hardTruncate,
  guardContext,
} from '@crai/runtime'

// ── Helper ──────────────────────────────────────────

function textMsg(role: string, text: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role: role as any,
    createdAt: Date.now(),
    parts: [{ type: 'text', text }],
  }
}

// 200 token（约 800 英文字符）
const MEDIUM_TEXT = 'word '.repeat(200)
// 10000 token（约 40000 英文字符）
const LARGE_TEXT = 'big '.repeat(10000)

// ── Token 估算 ──────────────────────────────────────

describe('estimateTokens', () => {
  it('空字符串 = 0', () => {
    assert.equal(estimateTokens(''), 0)
  })

  it('纯 ASCII', () => {
    // "hello world" = 11 字符 = ceil(11/4) = 3
    assert.equal(estimateTokens('hello world'), 3)
  })

  it('纯 CJK', () => {
    // "你好世界" = 4 个 CJK 字符 = ceil(4/1.5) = 3
    assert.equal(estimateTokens('你好世界'), 3)
  })

  it('混合文本', () => {
    // "你好 hello" = 2 CJK + 5 ASCII = ceil(2/1.5) + ceil(5/4) = 2 + 2 = 4
    const t = estimateTokens('你好 hello')
    assert.ok(t > 0)
  })
})

describe('estimateMessageTokens', () => {
  it('text part', () => {
    const msg = textMsg('user', 'hello')
    const tokens = estimateMessageTokens(msg)
    assert.ok(tokens > 0)
  })

  it('thinking part', () => {
    const msg: Message = {
      ...textMsg('assistant', ''),
      parts: [{ type: 'thinking', thinking: '思考中' }],
    }
    const tokens = estimateMessageTokens(msg)
    assert.ok(tokens > 0)
  })
})

describe('estimateMessagesTokens', () => {
  it('空数组 = 0', () => {
    // estimateMessagesTokens([]) 累加空数组返回 0
    assert.equal(estimateMessagesTokens([]), 0)
  })

  it('多条消息合计', () => {
    const msgs = [textMsg('user', 'a'), textMsg('assistant', 'b')]
    const single = estimateMessageTokens(msgs[0]) + estimateMessageTokens(msgs[1])
    assert.equal(estimateMessagesTokens(msgs), single)
  })
})

// ── Context Check ───────────────────────────────────

describe('checkContext', () => {
  it('空消息不走压缩', () => {
    const result = checkContext([], 'mock', 'mock', 0.8)
    assert.equal(result.needsCompression, false)
    assert.equal(result.currentTokens, 0)
  })

  it('超大消息触发压缩', () => {
    const bigMsg = textMsg('user', 'x '.repeat(10000))
    const msgs = Array(20).fill(bigMsg)
    // mock 窗口 65536，有效 58982，50% = 29491 token
    // 20 × ~2500 = ~50000 token > 29491
    const result = checkContext(msgs, 'mock', 'mock', 0.5)
    assert.equal(result.needsCompression, true)
    assert.ok(result.usageRatio > 0.5)
  })

  it('窗口从已知模型获取', () => {
    const result = checkContext([textMsg('user', 'hi')], 'openai', 'gpt-4o', 0.8)
    assert.equal(result.effectiveWindow, Math.floor(131072 * 0.9))
  })

  it('自定义阈值控制', () => {
    const msgs = Array.from({ length: 60 }, (_, i) =>
      i % 2 === 0 ? textMsg('user', `第 ${i} 条 ` + 'x '.repeat(200)) : textMsg('assistant', `回复 ${i} ` + 'y '.repeat(200))
    )
    // mock 窗口 65536，有效 58982，1% = 590 token
    // 60 条 × ~50 token = ~3000 token > 590
    const result = checkContext(msgs, 'mock', 'mock', 0.01)
    assert.equal(result.needsCompression, true)
  })
})

// ── Hard Truncate ───────────────────────────────────

describe('hardTruncate', () => {
  it('少于 2 条消息不截断', () => {
    const r = hardTruncate([textMsg('user', 'hi')], 1000)
    assert.equal(r.removedCount, 0)
  })

  it('截断早期消息', () => {
    // 10 条消息构成 5 轮，每轮 ~60 token，总计 ~300 token
    // keepRecentTokens=80，只够保留最后 2 轮（~120 token），前 3 轮（~180 token）应被移除
    const msgs: Message[] = []
    for (let i = 0; i < 5; i++) {
      msgs.push(textMsg('user', `user msg ${i}: ` + 'x '.repeat(30)))
      msgs.push(textMsg('assistant', `asst msg ${i}: ` + 'y '.repeat(30)))
    }
    const keepTokens = 80
    const r = hardTruncate(msgs, keepTokens)

    assert.ok(r.removedCount >= 2, `应移除至少 2 条，实际 ${r.removedCount}`)
    assert.ok(r.tokensBefore > r.tokensAfter, `tokensBefore ${r.tokensBefore} 未大于 tokensAfter ${r.tokensAfter}`)
    assert.ok(r.summary.length > 0)
  })

  it('分轮感知：不会切分 user/assistant 对', () => {
    // 4 轮：前 3 轮大（~150 token 每条），后 1 轮小（~10 token 每条）
    // keepTokens=~17 只够保留最后 1 轮 + 0 条大消息 → 前 2 轮（4 条）被完整移除
    const msgs: Message[] = []
    for (let i = 0; i < 3; i++) {
      msgs.push(textMsg('user', `第 ${i} 轮用户 ` + 'X '.repeat(300)))
      msgs.push(textMsg('assistant', `第 ${i} 轮 AI ` + 'Y '.repeat(300)))
    }
    msgs.push(textMsg('user', '最后 user'))
    msgs.push(textMsg('assistant', '最后 asst'))
    const lastRoundTokens = estimateMessageTokens(msgs[msgs.length - 2]) + estimateMessageTokens(msgs[msgs.length - 1])
    const keepTokens = lastRoundTokens + 5
    const r = hardTruncate(msgs, keepTokens)

    // 分轮感知：被移除的是完整的轮次（4 条 = 2 轮），不会切分任何一对 user/assistant
    assert.equal(r.removedCount, 4, `应移除 4 条（完整轮次），实际 ${r.removedCount}`)
    // 保留的消息中，user 和 assistant 数量应相等（都是完整轮次）
    const keptUserCount = r.truncated.filter(m => m.role === 'user').length
    const keptAsstCount = r.truncated.filter(m => m.role === 'assistant').length
    assert.equal(keptUserCount, keptAsstCount, `保留的消息中 user(${keptUserCount}) 和 assistant(${keptAsstCount}) 应成对`)
  })

  it('所有消息都不够保留时返回原数组', () => {
    const msgs = [textMsg('user', 'a'), textMsg('assistant', 'b')]
    const r = hardTruncate(msgs, 1000000)
    assert.equal(r.removedCount, 0)
  })
})

// ── Guard Context ───────────────────────────────────

describe('guardContext', () => {
  it('未超限时不压缩', async () => {
    const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')]
    const r = await guardContext(msgs, 'deepseek', 'deepseek-v4-flash', { threshold: 0.9 })
    assert.equal(r.compacted, false)
    assert.equal(r.method, 'none')
    assert.equal(r.messages.length, 2)
  })

  it('超限时触发压缩', async () => {
    // 用 mock provider（窗口 65536），60 条消息 ~12K token，超过 10% 阈值线（~5.9K）
    const msgs: Message[] = []
    for (let i = 0; i < 30; i++) {
      msgs.push(textMsg('user', `第 ${i} 轮 ` + 'big '.repeat(250)))
      msgs.push(textMsg('assistant', `回 ${i} ` + 'ans '.repeat(250)))
    }
    const r = await guardContext(msgs, 'mock', 'mock', {
      threshold: 0.1,
      keepRecentTokens: 4000,
    })
    assert.equal(r.compacted, true)
    assert.ok(r.messages.length < msgs.length, `压缩后 ${r.messages.length}，原 ${msgs.length}`)
    assert.equal(r.method, 'hard-truncate')
  })

  it('AI summarizer 可用时使用 AI 摘要', async () => {
    const msgs: Message[] = []
    for (let i = 0; i < 30; i++) {
      msgs.push(textMsg('user', `第 ${i} 轮 ` + 'big '.repeat(250)))
      msgs.push(textMsg('assistant', `回 ${i} ` + 'ans '.repeat(250)))
    }
    const r = await guardContext(msgs, 'mock', 'mock', {
      threshold: 0.1,
      keepRecentTokens: 4000,
      summarize: async () => 'AI 生成的摘要',
    })
    assert.equal(r.compacted, true)
    assert.equal(r.method, 'ai')
    const hasSummary = r.messages.some(m => m.parts.some(p => p.type === 'text' && (p as any).text.includes('AI 生成的摘要')))
    assert.equal(hasSummary, true)
  })

  it('AI summarizer 失败时回退硬截断', async () => {
    const msgs: Message[] = []
    for (let i = 0; i < 30; i++) {
      msgs.push(textMsg('user', `第 ${i} 轮 ` + 'big '.repeat(250)))
      msgs.push(textMsg('assistant', `回 ${i} ` + 'ans '.repeat(250)))
    }
    const r = await guardContext(msgs, 'mock', 'mock', {
      threshold: 0.1,
      keepRecentTokens: 4000,
      summarize: async () => { throw new Error('summarizer failed') },
    })
    assert.equal(r.compacted, true)
    assert.equal(r.method, 'hard-truncate')
  })
})
