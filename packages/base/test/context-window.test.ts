/**
 * @crai/base — 上下文窗口管理与压缩测试。
 *
 * 覆盖：
 * - Token 估算
 * - findPreserveStartIndex（tool 链保护）
 * - cleanOrphanedToolCalls（孤立消息清理）
 * - hardTruncate（硬截断 + tool 链保护 + 分轮感知）
 * - guardContext（含重试逻辑）
 * - token-limiter（工具结果限流）
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Message } from '@crai/core'
import {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  findPreserveStartIndex,
  cleanOrphanedToolCalls,
  hardTruncate,
  checkContext,
  guardContext,
} from '../src/context-window'
import {
  limitToolResult,
  truncateToolResult,
  getToolResultTokenLimit,
} from '../src/token-limiter'
import type { MessagePart, TextPart } from '@crai/core'

// ── 辅助函数 ────────────────────────────────────────

function makeMsg(role: 'user' | 'assistant' | 'system' | 'tool', text: string, opts?: { isToolCall?: boolean; toolCallId?: string; toolName?: string }): Message {
  const parts: MessagePart[] = opts?.isToolCall
    ? [{ type: 'tool-call' as const, toolCallId: opts.toolCallId ?? 'tc1', name: opts.toolName ?? 'test-tool', arguments: '{}' }]
    : [{ type: 'text' as const, text }]
  const m: Message = { id: `msg-${Math.random()}`, role, createdAt: Date.now(), parts }
  if (opts?.toolCallId) m.toolCallId = opts.toolCallId
  if (opts?.toolName) m.toolName = opts.toolName
  return m
}

function textMsg(role: 'user' | 'assistant' | 'system', text: string): Message {
  return makeMsg(role, text)
}

function toolCallMsg(text: string, toolCallId: string, toolName?: string): Message {
  return makeMsg('assistant', text, { isToolCall: true, toolCallId, toolName })
}

function toolResultMsg(toolCallId: string, text: string): Message {
  return makeMsg('tool', text, { toolCallId, toolName: 'test' })
}

// ── 混合测试：同时覆盖多种场景 ─────────────────────

describe('context-window', () => {

  // ── Token 估算 ──

  it('estimateTokens: 空文本返回 0', () => {
    assert.equal(estimateTokens(''), 0)
  })

  it('estimateTokens: ASCII 文本按 4 字符/token 计算', () => {
    // "hello" = 5 ASCII chars → ceil(5/4) = 2
    assert.equal(estimateTokens('hello'), 2)
  })

  it('estimateTokens: CJK 文本按 1.5 字符/token 计算', () => {
    // "你好" = 2 CJK chars → ceil(2/1.5) = 2
    assert.equal(estimateTokens('你好'), 2)
  })

  it('estimateMessageTokens: 含 text 和 tool-call parts', () => {
    const msg: Message = {
      id: 'm1', role: 'assistant', createdAt: Date.now(),
      parts: [
        { type: 'text', text: 'hello' },
        { type: 'tool-call', toolCallId: 'tc1', name: 'read', arguments: '{}' },
      ],
    }
    const tokens = estimateMessageTokens(msg)
    assert.ok(tokens > 0)
    assert.ok(tokens < 20)
  })

  it('estimateMessagesTokens: 多条消息求和', () => {
    const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')]
    assert.ok(estimateMessagesTokens(msgs) > 0)
  })

  // ── findPreserveStartIndex ──

  it('findPreserveStartIndex: 空消息返回 0', () => {
    assert.equal(findPreserveStartIndex([]), 0)
  })

  it('findPreserveStartIndex: 末尾是普通 assistant 时全部可压缩', () => {
    const msgs = [textMsg('user', 'hello'), textMsg('assistant', 'world')]
    assert.equal(findPreserveStartIndex(msgs), msgs.length)
  })

  it('findPreserveStartIndex: 末尾是普通 user 时全部可压缩', () => {
    const msgs = [textMsg('assistant', 'world'), textMsg('user', 'hello')]
    assert.equal(findPreserveStartIndex(msgs), msgs.length)
  })

  it('findPreserveStartIndex: 末尾是 tool 结果时保留整个 tool 链', () => {
    const msgs = [
      textMsg('user', 'search'),
      toolCallMsg('', 'tc1', 'search'),
      toolResultMsg('tc1', 'results...'),
    ]
    // assistant(tool_calls) → tool → 保留这条链
    assert.equal(findPreserveStartIndex(msgs), 1)
  })

  it('findPreserveStartIndex: 末尾是 assistant(tool_calls) 时保留', () => {
    const msgs = [
      textMsg('user', 'search'),
      toolCallMsg('', 'tc1', 'search'),
    ]
    assert.equal(findPreserveStartIndex(msgs), 1)
  })

  it('findPreserveStartIndex: 末尾 tool 结果找不到对应 assistant 时全部可压缩', () => {
    const msgs = [
      textMsg('user', 'hello'),
      textMsg('assistant', 'world'),
      toolResultMsg('tc1', 'orphaned'),
    ]
    // tool 结果没有对应的 assistant(tool_calls) → 退回到 case 3
    assert.equal(findPreserveStartIndex(msgs), msgs.length)
  })

  it('findPreserveStartIndex: 长 chain 中只保留最后一条 tool 链', () => {
    const msgs = [
      textMsg('user', 'first'),
      textMsg('assistant', 'reply1'),
      textMsg('user', 'second'),
      toolCallMsg('', 'tc2', 'search'),
      toolResultMsg('tc2', 'data'),
      toolCallMsg('', 'tc3', 'next'),
    ]
    // 最后是 assistant(tool_calls) → 保留最后一条消息
    assert.equal(findPreserveStartIndex(msgs), msgs.length - 1)
  })

  // ── cleanOrphanedToolCalls ──

  it('cleanOrphanedToolCalls: 完整 tool 链不变', () => {
    const msgs = [
      toolCallMsg('thinking', 'tc1', 'read'),
      toolResultMsg('tc1', 'result data'),
    ]
    const copy = [...msgs]
    cleanOrphanedToolCalls(copy)
    assert.equal(copy.length, 2)
  })

  it('cleanOrphanedToolCalls: 删除没有 tool 结果的 assistant(tool_calls)', () => {
    const msgs = [
      textMsg('user', 'do it'),
      toolCallMsg('', 'tc_orphan', 'search'),
      textMsg('assistant', 'done'),
    ]
    const copy = [...msgs]
    cleanOrphanedToolCalls(copy)
    assert.equal(copy.length, 2)
    assert.equal(copy[0].role, 'user')
    assert.equal(copy[1].role, 'assistant')
    assert.equal(copy[1].parts[0].type, 'text')
  })

  it('cleanOrphanedToolCalls: 删除没有对应 assistant 的 tool 结果', () => {
    const msgs = [
      textMsg('user', 'hello'),
      toolResultMsg('tc_missing', 'orphaned result'),
    ]
    const copy = [...msgs]
    cleanOrphanedToolCalls(copy)
    assert.equal(copy.length, 1)
  })

  it('cleanOrphanedToolCalls: 多个 tool 链中只删除孤立的', () => {
    const msgs = [
      toolCallMsg('', 'tc1', 'read'),
      toolResultMsg('tc1', 'file content'),
      toolCallMsg('', 'tc2', 'write'),
      // tc2 没有对应 tool result → 应被删除
    ]
    const copy = [...msgs]
    cleanOrphanedToolCalls(copy)
    assert.equal(copy.length, 2)
    assert.equal(copy[0].parts[0].type, 'tool-call')
    assert.equal((copy[0].parts[0] as any).toolCallId, 'tc1')
    assert.equal(copy[1].role, 'tool')
  })

  it('cleanOrphanedToolCalls: 空消息不变', () => {
    const msgs: Message[] = []
    cleanOrphanedToolCalls(msgs)
    assert.equal(msgs.length, 0)
  })

  it('cleanOrphanedToolCalls: 没有 tool_calls 的消息不变', () => {
    const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')]
    const copy = [...msgs]
    cleanOrphanedToolCalls(copy)
    assert.deepEqual(copy, msgs)
  })

  // ── hardTruncate（含 tool 链保护） ──

  it('hardTruncate: 少于 2 条消息不截断', () => {
    const result = hardTruncate([textMsg('user', 'hi')])
    assert.equal(result.truncated.length, 1)
    assert.equal(result.removedCount, 0)
  })

  it('hardTruncate: 不截断 tool 链消息', () => {
    // 完整的 tool 链：assistant(tool_calls) 紧跟着 tool 结果
    const msgs = [
      textMsg('user', 'explore the system deeply with many details for token accumulation'),
      textMsg('assistant', 'sure, let me investigate thoroughly and provide a comprehensive response'),
      textMsg('user', 'now find the configuration file and read its contents'),
      toolCallMsg('', 'tc1', 'search'),
      toolResultMsg('tc1', 'found config file with the following settings and parameters'),
    ]
    const result = hardTruncate(msgs, 1) // 极低 keepRecentTokens 强制截断
    // 最后是完整的 tool 链 → 不被截断
    assert.ok(result.truncated.length >= 3)
    assert.ok(result.truncated.some(m => m.parts.some(p => p.type === 'tool-call')))
  })

  it('hardTruncate: 压缩后插入摘要占位符', () => {
    // 创建足够多的消息使 keepRecentTokens=5 能触发截断
    const msgs: Message[] = []
    for (let i = 0; i < 20; i++) {
      msgs.push(textMsg('user', `a very long user message number ${i} that contains plenty of text to consume tokens`))
      msgs.push(textMsg('assistant', `a comprehensive assistant response number ${i} with detailed explanation and analysis`))
    }
    const result = hardTruncate(msgs, 20)
    assert.ok(result.truncated.length > 0)
    const first = result.truncated[0]
    assert.equal(first.role, 'system')
    assert.equal(first.id, 'ctx-compaction')
    assert.ok((first.parts[0] as TextPart).text.includes('早期对话历史已被截断'))
  })

  it('hardTruncate: 分轮感知 — 不切分 user/assistant 对', () => {
    // 创建交替消息，确保截断点在 user 边界
    const msgs: Message[] = []
    for (let i = 0; i < 8; i++) {
      msgs.push(textMsg('user', `user msg ${i}`))
      msgs.push(textMsg('assistant', `asst reply ${i}`))
    }
    const result = hardTruncate(msgs, 50)
    // 截断后的第一条消息（摘要之后）应该是 user 角色
    const firstKept = result.truncated[1]
    if (firstKept) {
      assert.equal(firstKept.role, 'user')
    }
  })

  it('hardTruncate: 清理孤立 tool 消息', () => {
    // 大量早期消息 + 末尾孤立 toolCall → 早期被截断 + 孤立被清理
    const msgs: Message[] = []
    for (let i = 0; i < 8; i++) {
      msgs.push(textMsg('user', `earlier conversation message number ${i} with enough details and context`))
      msgs.push(textMsg('assistant', `response to message ${i} with comprehensive analysis and thorough explanation`))
    }
    // 末尾加一个孤立的 tool_call（没有 tool 结果跟随）
    msgs.push(toolCallMsg('', 'tc_orphan', 'read'))
    msgs.push(textMsg('user', 'final question about the project architecture and design decisions'))
    msgs.push(textMsg('assistant', 'final comprehensive answer covering all the key points and recommendations'))
    const result = hardTruncate(msgs, 15)
    // 孤立消息应在压缩后被清理
    const toolCallsAfter = result.truncated.filter(m =>
      m.parts.some(p => p.type === 'tool-call')
    )
    assert.equal(toolCallsAfter.length, 0)
  })

  // ── checkContext ──

  it('checkContext: 较少消息不触发压缩', () => {
    const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')]
    const result = checkContext(msgs, 'test', 'test-model', 0.5)
    assert.equal(result.needsCompression, false)
  })

  it('checkContext: 极低阈值触发压缩', () => {
    // 65536*0.9=58982 有效窗口，0.001 阈值 = 约 59 token
    // 每条消息约 20-30 token（角色 4 + 文本 16-26），2 条约 40-60
    // 每条消息放足够文本确保超过 59 token
    const msgs = [
      textMsg('user', 'a very long user message that contains many words to consume enough tokens to exceed the compression threshold limit for this test case validation'),
      textMsg('assistant', 'a very long assistant response that also contains many words and detailed explanations to help reach the token threshold needed for compression testing purposes'),
    ]
    const result = checkContext(msgs, 'test', 'test-model', 0.001)
    assert.equal(result.needsCompression, true)
  })

  // ── guardContext（含重试逻辑） ──

  it('guardContext: 不超限时不压缩', async () => {
    const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')]
    const result = await guardContext(msgs, 'test', 'test-model', { threshold: 0.99 })
    assert.equal(result.compacted, false)
    assert.equal(result.method, 'none')
  })

  it('guardContext: AI 摘要成功时返回 method=ai', async () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      textMsg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`)
    )
    const mockSummarize = async () => '测试摘要内容'
    const result = await guardContext(msgs, 'test', 'test-model', {
      threshold: 0.001,
      summarize: mockSummarize,
    })
    assert.equal(result.compacted, true)
    assert.ok(result.method === 'ai' || result.method === 'ai-retry')
  })

  it('guardContext: AI 摘要失败后回退硬截断', async () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      textMsg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`)
    )
    const mockSummarize = async () => null // 返回 null = 失败
    const result = await guardContext(msgs, 'test', 'test-model', {
      threshold: 0.001,
      summarize: mockSummarize,
      retryEnabled: false, // 跳过重试
    })
    assert.equal(result.compacted, true)
    assert.equal(result.method, 'hard-truncate')
  })

  it('guardContext: AI 摘要抛出异常后回退硬截断', async () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      textMsg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`)
    )
    const mockSummarize = async () => { throw new Error('API error') }
    const result = await guardContext(msgs, 'test', 'test-model', {
      threshold: 0.001,
      summarize: mockSummarize,
      retryEnabled: false,
    })
    assert.equal(result.compacted, true)
    assert.equal(result.method, 'hard-truncate')
  })

  it('guardContext: 保留最近的 2 轮并更新上下文', async () => {
    const msgs: Message[] = []
    for (let i = 0; i < 6; i++) {
      msgs.push(textMsg('user', `q${i}`))
      msgs.push(textMsg('assistant', `a${i}`))
    }
    const mockSummarize = async () => 'summary text'
    const result = await guardContext(msgs, 'test', 'test-model', {
      threshold: 0.001,
      summarize: mockSummarize,
    })
    assert.equal(result.compacted, true)
    // 应保留摘要 + 最近 2 轮（4 条消息）
    assert.ok(result.messages.length <= 5)
    assert.equal(result.messages[0].parts[0].type, 'text')
    assert.ok((result.messages[0].parts[0] as TextPart).text.includes('summary'))
  })
})

// ── token-limiter ──

describe('token-limiter', () => {

  it('getToolResultTokenLimit: 默认 30% 上下文窗口', () => {
    const limit = getToolResultTokenLimit(100000)
    assert.equal(limit, 30000)
  })

  it('getToolResultTokenLimit: 自定义比例', () => {
    const limit = getToolResultTokenLimit(100000, 0.5)
    assert.equal(limit, 50000)
  })

  it('getToolResultTokenLimit: 限制在 10%-80% 范围内', () => {
    assert.equal(getToolResultTokenLimit(100000, 0.05), 10000)  // 下限
    assert.equal(getToolResultTokenLimit(100000, 0.90), 80000)  // 上限
  })

  it('limitToolResult: 短结果不截断', () => {
    const parts: MessagePart[] = [{ type: 'text', text: 'short result' }]
    const result = limitToolResult(parts, 100000)
    assert.equal(result.truncated, false)
    assert.equal(result.parts.length, 1)
  })

  it('limitToolResult: 过长结果截断', () => {
    const parts: MessagePart[] = [{ type: 'text', text: 'x'.repeat(10000) }]
    const result = limitToolResult(parts, 1000) // 1000 token 限制
    // 注意：CJK 估算，1000 token ≈ 4000 ASCII chars
    // 10000 chars ≈ 2500 token → 超过 30% × 1000 = 300 token
    assert.equal(result.truncated, true)
    assert.ok(result.parts.length === 1)
    const text = (result.parts[0] as TextPart).text
    assert.ok(text.length < 2000, `截断后长度 ${text.length} 应小于原始长度`)
    assert.ok(text.includes('characters truncated'), '应包含截断标记')
  })

  it('limitToolResult: 多个 parts 优先保留后面的', () => {
    const parts: MessagePart[] = [
      { type: 'text', text: 'important summary with key findings and results' },
      { type: 'text', text: 'x'.repeat(8000) },
    ]
    const result = limitToolResult(parts, 1000)
    assert.equal(result.truncated, true)
    // 短的 part 应被保留
    const keptTexts = result.parts.filter(p => p.type === 'text').map(p => (p as TextPart).text)
    assert.ok(keptTexts.some(t => t.includes('important summary')))
  })
})
