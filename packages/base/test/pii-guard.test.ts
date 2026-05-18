/**
 * pii-guard.test.ts — PII 检测与脱敏测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeText, sanitizeParts } from '../src/pii-guard'

// ── sanitizeText ──

describe('sanitizeText', () => {
  it('检测并脱敏 OpenAI API key', () => {
    const input = 'api key is sk-Ax3fK9mN2qR7vW8yB5cL1pQ4sT6uX0gJ'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('api_key'))
    assert.equal(text, 'api key is [REDACTED]')
  })

  it('检测并脱敏 AWS IAM key', () => {
    const input = 'aws key: AKIAIOSFODNN7EXAMPLE'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('api_key'))
    assert.equal(text, 'aws key: [REDACTED]')
  })

  it('检测并脱敏内联 secret', () => {
    const input = 'api_key = "jt9m2x8k4p6vq3r7w1c5n0b2a4d6f8e0"'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('inline_secret'))
    assert.ok(!text.includes('jt9m2x8k4p6vq3r7w1c5n0b2a4d6f8e0'))
  })

  it('检测并脱敏 PEM 私钥', () => {
    const input = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD\n-----END RSA PRIVATE KEY-----'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('private_key'))
    assert.ok(!text.includes('RSA PRIVATE KEY'))
  })

  it('检测并脱敏信用卡号', () => {
    const input = 'card: 4532 1234 5678 9012'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('credit_card'))
    assert.equal(text, 'card: [REDACTED]')
  })

  it('检测并脱敏中国身份证号', () => {
    const input = '身份证号 110101199003071234'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('id_card'))
    assert.equal(text, '身份证号 [REDACTED]')
  })

  it('检测并脱敏美国社会安全号', () => {
    const input = 'ssn: 123-45-6789'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('ssn'))
    assert.equal(text, 'ssn: [REDACTED]')
  })

  it('检测并脱敏中国大陆手机号', () => {
    const input = 'phone: 13800138000'
    const { text, hits } = sanitizeText(input)
    assert.ok(hits.includes('phone_cn'))
    assert.equal(text, 'phone: [REDACTED]')
  })

  it('纯文本不触发脱敏', () => {
    const input = '今天天气不错，文件在 project/src/main.ts 里'
    const { text, hits } = sanitizeText(input)
    assert.equal(hits.length, 0)
    assert.equal(text, input)
  })

  it('多次命中记录所有分类', () => {
    const input = 'key: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, card: 4532123456789012'
    const { hits } = sanitizeText(input)
    assert.ok(hits.length >= 2)
    assert.ok(hits.includes('api_key'))
  })

  it('短 API key（小于 20 字符）不触发', () => {
    const input = 'key: sk-short'
    const { text, hits } = sanitizeText(input)
    assert.equal(hits.length, 0)
    assert.equal(text, input)
  })
})

// ── sanitizeParts ──

describe('sanitizeParts', () => {
  it('敏感文本被脱敏', () => {
    const parts = [
      { type: 'text', text: 'my api key is sk-Ax3fK9mN2qR7vW8yB5cL1pQ4sT6uX0gJ' },
    ]
    const { parts: result, hits } = sanitizeParts(parts)
    assert.ok(hits.includes('api_key'))
    assert.equal(result[0].text, 'my api key is [REDACTED]')
  })

  it('thinking 类型 parts 也被脱敏', () => {
    const parts = [
      { type: 'thinking', thinking: 'secret is sk-Ax3fK9mN2qR7vW8yB5cL1pQ4sT6uX0gJ' },
    ]
    const { parts: result, hits } = sanitizeParts(parts)
    assert.ok(hits.length > 0)
    assert.ok(!(result[0] as any).thinking.includes('sk-test-key'))
  })

  it('未命中时返回原 parts', () => {
    const parts = [
      { type: 'text', text: 'hello world' },
      { type: 'thinking', thinking: 'just thinking' },
    ]
    const { parts: result, hits } = sanitizeParts(parts)
    assert.equal(hits.length, 0)
    assert.deepEqual(result, parts)
  })

  it('非 text/thinking 类型透传', () => {
    const parts = [
      { type: 'tool-call', name: 'read', arguments: { path: '/safe' } },
    ]
    const { parts: result, hits } = sanitizeParts(parts)
    assert.equal(hits.length, 0)
    assert.deepEqual(result, parts)
  })
})
