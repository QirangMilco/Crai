/**
 * known-models.test.ts — 模型注册表测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  KNOWN_MODELS,
  getModelInfo,
  getContextWindow,
  getMaxOutput,
  DEFAULT_CONTEXT_WINDOW,
} from '@crai/core'

describe('KNOWN_MODELS 结构', () => {
  it('包含主要 provider', () => {
    assert.ok('deepseek' in KNOWN_MODELS)
    assert.ok('openai' in KNOWN_MODELS)
    assert.ok('anthropic' in KNOWN_MODELS)
    assert.ok('mock' in KNOWN_MODELS)
  })

  it('每个模型的 contextWindow > 0', () => {
    for (const [provider, models] of Object.entries(KNOWN_MODELS)) {
      for (const [name, info] of Object.entries(models)) {
        assert.ok(info.contextWindow > 0,
          `${provider}/${name} contextWindow 应为正数，实际 ${info.contextWindow}`)
      }
    }
  })
})

describe('getModelInfo', () => {
  it('精确匹配', () => {
    const info = getModelInfo('deepseek', 'deepseek-v4-flash')
    assert.ok(info)
    assert.equal(info!.contextWindow, 1048576)
  })

  it('跨 provider 模糊匹配', () => {
    // "claude-3-5-sonnet" 匹配 anthropic
    const info = getModelInfo('', 'claude-3-5-sonnet-20241022')
    assert.ok(info)
    assert.equal(info!.contextWindow, 200000)
  })

  it('未知模型返回 undefined', () => {
    const info = getModelInfo('unknown', 'non-existent-model')
    assert.equal(info, undefined)
  })

  it('自定义上下文窗口覆盖', () => {
    const info = getModelInfo('openai', 'gpt-4o', { 'gpt-4o': 9999 })
    assert.ok(info)
    assert.equal(info!.contextWindow, 9999)
  })
})

describe('getContextWindow', () => {
  it('已知模型返回正确窗口', () => {
    assert.equal(getContextWindow('openai', 'gpt-4o'), 128000)
    assert.equal(getContextWindow('deepseek', 'deepseek-reasoner'), 65536)
  })

  it('未知模型返回默认值', () => {
    assert.equal(getContextWindow('unknown', 'unknown'), DEFAULT_CONTEXT_WINDOW)
  })

  it('自定义窗口覆盖已知模型', () => {
    assert.equal(getContextWindow('openai', 'gpt-4o', { 'gpt-4o': 50000 }), 50000)
  })
})

describe('getMaxOutput', () => {
  it('已知模型的 maxOutput', () => {
    assert.equal(getMaxOutput('openai', 'gpt-4o'), 16384)
    assert.equal(getMaxOutput('openai', 'o1'), 100000)
  })

  it('无 maxOutput 的模型使用默认', () => {
    const max = getMaxOutput('deepseek', 'deepseek-v4-flash')
    assert.ok(max >= 4096)
  })
})
