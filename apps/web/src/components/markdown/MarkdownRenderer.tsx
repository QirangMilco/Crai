/**
 * MarkdownRenderer — AI 消息的 Markdown 渲染器。
 *
 * 基于 react-markdown，集成 GFM、数学公式、语法高亮。
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { CodeBlock } from './CodeBlock'

interface Props {
  content: string
}

const components = {
  // 代码块
  code: ({ className, children, ...props }: any) => {
    const match = /language-([\w-]+)/.exec(className || '')
    const isBlock = props.node?.position?.start.line !== props.node?.position?.end.line
    const code = String(children).replace(/\n$/, '')

    if (match || isBlock) {
      return <span data-token-group="code-block"><CodeBlock code={code} language={match?.[1]} /></span>
    }
    // 行内代码
    return (
      <code data-token-group="blockquote" className="px-1 py-0.5 rounded text-sm"
        style={{
          backgroundColor: 'var(--crai-md-inline-code-bg)',
          color: 'var(--crai-fg)',
          fontSize: 'var(--crai-md-code-font-size)',
        }}>
        {children}
      </code>
    )
  },
  pre: ({ children }: any) => <>{children}</>,

  // 段落
  p: ({ children }: any) => <p className="my-2 leading-relaxed"
    style={{ fontSize: 'var(--crai-md-paragraph-font-size, 14px)' }}>{children}</p>,

  // 列表
  ul: ({ children, className }: any) => (
    <ul className={`my-2 space-y-1 pl-5 list-disc ${className ?? ''}`}
      style={{ color: 'var(--crai-fg)' }}>
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="my-2 space-y-1 pl-5 list-decimal" style={{ color: 'var(--crai-fg)' }}>
      {children}
    </ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,

  // 标题
  h1: ({ children }: any) => <h1 data-token-group="heading" className="font-bold mt-2 mb-3" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-h1-font-size, 16px)' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 data-token-group="heading" className="font-semibold mt-2 mb-2" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-h2-font-size, 16px)' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 data-token-group="heading" className="font-semibold mt-2 mb-2" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-h3-font-size, 14px)' }}>{children}</h3>,
  h4: ({ children }: any) => <h4 data-token-group="heading" className="font-semibold mt-2 mb-2" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-h4-font-size, 14px)' }}>{children}</h4>,
  h5: ({ children }: any) => <h5 data-token-group="heading" className="font-semibold mt-2 mb-1" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-paragraph-font-size, 14px)' }}>{children}</h5>,
  h6: ({ children }: any) => <h6 data-token-group="heading" className="font-semibold mt-2 mb-1" style={{ color: 'var(--crai-md-heading-color)', fontWeight: 'var(--crai-md-heading-weight)', fontSize: 'var(--crai-md-paragraph-font-size, 14px)' }}>{children}</h6>,

  // 表格
  table: ({ children }: any) => (
    <div data-token-group="table" className="my-3 overflow-x-auto" style={{ border: '1px solid var(--crai-md-table-border)', borderRadius: 'var(--crai-md-code-radius, 8px)' }}>
      <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse', color: 'var(--crai-md-table-fg)' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead style={{ backgroundColor: 'var(--crai-md-table-header-bg)' }}>{children}</thead>,
  th: ({ children }: any) => <th className="text-left font-semibold text-xs"
    style={{
      padding: 'var(--crai-md-table-cell-padding, 8px 12px)',
      border: '1px solid var(--crai-md-table-border)',
    }}>{children}</th>,
  td: ({ children }: any) => <td className="text-xs"
    style={{
      border: '1px solid var(--crai-md-table-border)',
      backgroundColor: 'var(--crai-md-table-body-bg)',
      padding: 'var(--crai-md-table-cell-padding, 8px 12px)',
    }}>{children}</td>,

  // 引用
  blockquote: ({ children }: any) => (
    <blockquote data-token-group="blockquote" className="pl-3 pr-2 py-1 my-2 rounded-r"
      style={{
        borderLeft: 'var(--crai-md-blockquote-border-width, 4px) solid var(--crai-md-blockquote-border)',
        backgroundColor: 'var(--crai-md-blockquote-bg)',
        color: 'var(--crai-md-blockquote-fg)',
      }}>
      {children}
    </blockquote>
  ),

  // 分割线
  hr: () => <hr className="my-4" style={{ borderColor: 'var(--crai-border)' }} />,

  // 行内样式
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ color: 'var(--crai-md-link-color)' }}
      className="hover:underline">
      {children}
    </a>
  ),
}

export function MarkdownRenderer({ content }: Props) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
