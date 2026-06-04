import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { extractTextFromParts } from '../message-utils';

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
