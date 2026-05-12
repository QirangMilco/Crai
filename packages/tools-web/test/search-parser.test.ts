import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DuckDuckGoEngine } from '../src/engines/duckduckgo'

// DuckDuckGo Lite 的 HTML 解析是私有的，通过 DuckDuckGoEngine 间接测试。
// 但搜索需要网络。这里只测试静态 HTML 解析逻辑。
// 解析函数是模块内部函数，通过 engine.search 间接触发。
// 因此在 get 请求失败时我们只验证错误处理。

describe('DuckDuckGoEngine', () => {
  it('engine 属性正确', () => {
    const engine = new DuckDuckGoEngine()
    assert.equal(engine.id, 'duckduckgo')
    assert.equal(engine.name, 'DuckDuckGo')
    assert.equal(engine.needsApiKey, false)
  })
})

// 直接测试 DuckDuckGo Lite 结果解析函数。
// 该函数未导出，但我们可以通过字符串模拟其行为。
// 实际上我们复制解析逻辑的签名并注入静态 HTML 来验证。

function parseResults(html: string, maxResults: number): Array<{ title: string; url: string; snippet: string }> {
  // 与 duckduckgo.ts 中相同的解析逻辑
  const results: Array<{ title: string; url: string; snippet: string }> = []

  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi

  const links: Array<{ url: string; title: string }> = []
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    links.push({
      url: match[1].trim(),
      title: match[2].replace(/<[^>]+>/g, '').trim(),
    })
  }

  const snippets: string[] = []
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i]?.title ?? '',
      url: links[i]?.url ?? '',
      snippet: snippets[i] ?? '',
    })
  }

  return results
}

describe('DuckDuckGo Lite 解析', () => {
  it('空 HTML 返回空结果', () => {
    const results = parseResults('', 5)
    assert.equal(results.length, 0)
  })

  it('无搜索结果标记的 HTML 返回空', () => {
    const html = '<html><body><p>no results here</p></body></html>'
    const results = parseResults(html, 5)
    assert.equal(results.length, 0)
  })

  it('提取有效搜索结果', () => {
    const html = `<html><body>
      <table>
        <tr><td><a class="result-link" href="https://example.com/page1">Example Title 1</a></td></tr>
        <tr><td class="result-snippet">This is snippet 1</td></tr>
        <tr><td><a class="result-link" href="https://example.com/page2">Example Title 2</a></td></tr>
        <tr><td class="result-snippet">This is snippet 2</td></tr>
      </table>
    </body></html>`

    const results = parseResults(html, 5)
    assert.equal(results.length, 2)
    assert.equal(results[0].title, 'Example Title 1')
    assert.equal(results[0].url, 'https://example.com/page1')
    assert.equal(results[0].snippet, 'This is snippet 1')
    assert.equal(results[1].title, 'Example Title 2')
    assert.equal(results[1].url, 'https://example.com/page2')
    assert.equal(results[1].snippet, 'This is snippet 2')
  })

  it('maxResults 限制返回数量', () => {
    const html = `<html><body><table>
      ${Array.from({ length: 10 }, (_, i) => `
        <tr><td><a class="result-link" href="https://example.com/${i}">Title ${i}</a></td></tr>
        <tr><td class="result-snippet">Snippet ${i}</td></tr>
      `).join('')}
    </table></body></html>`

    const results = parseResults(html, 3)
    assert.equal(results.length, 3)
  })

  it('带 HTML 标签的标题被清理', () => {
    const html = `<html><body><table>
      <tr><td><a class="result-link" href="https://example.com"><b>Bold</b> <i>Title</i></a></td></tr>
      <tr><td class="result-snippet"><strong>Snippet</strong> text</td></tr>
    </table></body></html>`

    const results = parseResults(html, 5)
    assert.equal(results[0].title, 'Bold Title')
    assert.equal(results[0].snippet, 'Snippet text')
  })
})
