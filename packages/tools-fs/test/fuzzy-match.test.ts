import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findBestMatch } from '../src/fuzzy-match'

describe('findBestMatch', () => {
  const code = `import { foo } from './bar'

function greet(name: string) {
  console.log(\`Hello, \${name}!\`)
}

function add(a: number, b: number): number {
  return a + b
}
`

  it('精确匹配返回 score=1', () => {
    const result = findBestMatch(code, 'function greet(name: string) {')
    assert.ok(result)
    assert.equal(result!.score, 1)
    assert.ok(result!.index >= 0)
  })

  it('精确匹配不存在的文本返回 null', () => {
    const result = findBestMatch(code, 'this does not exist in the file')
    assert.equal(result, null)
  })

  it('归一化行匹配：多余空格', () => {
    // 原文是 "console.log(...)" ，搜索时加空格
    const result = findBestMatch(code, 'console.log(  `Hello, ${name}!`)')
    assert.ok(result)
    assert.ok(result!.score >= 0.75)
  })

  it('模糊匹配：轻微文本差异', () => {
    const result = findBestMatch(code, 'function greet(name: strng) {') // typo
    assert.ok(result)
    assert.ok(result!.score >= 0.75)
  })

  it('模糊匹配不匹配的文本返回 null', () => {
    const result = findBestMatch(code, 'completely unrelated text')
    assert.equal(result, null)
  })

  it('空 searchText 返回 index=0', () => {
    const result = findBestMatch(code, '')
    assert.ok(result)
    assert.equal(result!.index, 0)
    assert.equal(result!.score, 1)
  })

  it('空 content 返回 null', () => {
    const result = findBestMatch('', 'something')
    assert.equal(result, null)
  })

  it('多行匹配精确', () => {
    const result = findBestMatch(code, 'function greet(name: string) {\n  console.log(`Hello, ${name}!`)')
    assert.ok(result)
    assert.equal(result!.score, 1)
  })
})
