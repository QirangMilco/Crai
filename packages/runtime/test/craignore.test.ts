import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert'
import { parseCraignore } from '../src/craignore.js'

describe('craignore', () => {
  it('returns empty array for empty content', () => {
    assert.deepStrictEqual(parseCraignore(''), [])
    assert.deepStrictEqual(parseCraignore('\n\n'), [])
  })

  it('ignores comments and blank lines', () => {
    const result = parseCraignore('# comment\n\n# another\n')
    assert.deepStrictEqual(result, [])
  })

  it('ignores negation lines', () => {
    const result = parseCraignore('node_modules\n!important.txt')
    assert.deepStrictEqual(result, ['node_modules'])
  })

  it('parses simple patterns', () => {
    const result = parseCraignore('node_modules/\n.git/\n*.log')
    assert.deepStrictEqual(result, ['node_modules', '.git', '*.log'])
  })

  it('strips trailing slashes', () => {
    const result = parseCraignore('node_modules/\ndist/')
    assert.deepStrictEqual(result, ['node_modules', 'dist'])
  })

  it('trims whitespace from lines', () => {
    const result = parseCraignore('  node_modules/  \n  dist  ')
    assert.deepStrictEqual(result, ['node_modules', 'dist'])
  })
})
