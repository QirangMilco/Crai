import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { extractTextFromParts, buildActivitiesFromParts } from '../message-utils';

describe('extractTextFromParts', () => {
  it('returns empty string for undefined', () => {
    assert.strictEqual(extractTextFromParts(undefined), '')
  })
  it('returns empty string for empty array', () => {
    assert.strictEqual(extractTextFromParts([]), '')
  })
  it('extracts text from text parts', () => {
    assert.strictEqual(extractTextFromParts([{ type: 'text', text: 'hello' }]), 'hello')
  })
  it('joins multiple text parts', () => {
    assert.strictEqual(extractTextFromParts([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'ab')
  })
  it('ignores non-text parts', () => {
    assert.strictEqual(extractTextFromParts([{ type: 'tool-call', id: '1' }, { type: 'text', text: 'result' }]), 'result')
  })
  it('returns empty when all parts are non-text', () => {
    assert.strictEqual(extractTextFromParts([{ type: 'thinking', thinking: '...' }]), '')
  })
})

describe('buildActivitiesFromParts', () => {
  it('builds thinking activity', () => {
    const acts = buildActivitiesFromParts([{ type: 'thinking', thinking: '思考中' }])
    assert.strictEqual(acts.length, 1)
    assert.strictEqual(acts[0].type, 'thinking')
    assert.strictEqual(acts[0].status, 'completed')
    assert.strictEqual(acts[0].content, '思考中')
  })
  it('builds tool-call activity with intent from preceding text', () => {
    const acts = buildActivitiesFromParts([
      { type: 'text', text: '读取文件' },
      { type: 'tool-call', toolCallId: 'tc1', name: 'fs_read', arguments: { path: '/tmp/a' } },
    ])
    assert.strictEqual(acts.length, 1)
    assert.strictEqual(acts[0].type, 'tool')
    assert.strictEqual(acts[0].toolName, 'fs_read')
    assert.strictEqual(acts[0].intent, '读取文件')
  })
  it('builds both thinking and tool activities', () => {
    const acts = buildActivitiesFromParts([
      { type: 'thinking', thinking: '分析中' },
      { type: 'text', text: '执行命令' },
      { type: 'tool-call', toolCallId: 'tc1', name: 'bash', arguments: { command: 'ls' } },
      { type: 'text', text: '完成' },
    ])
    assert.strictEqual(acts.length, 2)
    assert.strictEqual(acts[0].type, 'thinking')
    assert.strictEqual(acts[1].type, 'tool')
    assert.strictEqual(acts[1].intent, '执行命令')
  })
  it('marks as aborted when stopReason is aborted', () => {
    const acts = buildActivitiesFromParts(
      [{ type: 'thinking', thinking: '思考' }],
      'aborted',
    )
    assert.strictEqual(acts[0].status, 'aborted')
  })
  it('returns empty for text-only parts', () => {
    const acts = buildActivitiesFromParts([{ type: 'text', text: 'hello' }])
    assert.strictEqual(acts.length, 0)
  })
})
