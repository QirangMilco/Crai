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
    assert.equal(info!.contextWindow, 204800)
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
    assert.equal(getContextWindow('openai', 'gpt-4o'), 131072)
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
    assert.equal(getMaxOutput('openai', 'o1'), 102400)
  })

  it('无 maxOutput 的模型使用默认', () => {
    const max = getMaxOutput('deepseek', 'deepseek-v4-flash')
    assert.ok(max >= 4096)
  })
})

describe('displayName', () => {
  it('真实模型都有 displayName', () => {
    for (const [provider, models] of Object.entries(KNOWN_MODELS)) {
      if (provider === 'mock') continue // mock 模型不需要 displayName
      for (const [name, info] of Object.entries(models)) {
        assert.ok(info.displayName,
          `${provider}/${name} 缺少 displayName`)
        assert.ok(info.displayName!.length > 0,
          `${provider}/${name} displayName 为空`)
      }
    }
  })

  it('getModelInfo 返回的 info 包含 displayName', () => {
    const info = getModelInfo('deepseek', 'deepseek-v4-flash')
    assert.equal(info?.displayName, 'DeepSeek V4 Flash')
  })

  it('mock 模型允许没有 displayName', () => {
    const info = getModelInfo('mock', 'mock')
    // mock 可以有 displayName，但不强制检查
    assert.ok(info)
    assert.equal(info!.contextWindow, 65536)
  })
})
