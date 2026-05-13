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
      return <CodeBlock code={code} language={match?.[1]} />
    }
    // 行内代码
    return (
      <code className="px-1 py-0.5 rounded text-sm"
        style={{
          backgroundColor: 'var(--crai-bg-tertiary)',
          color: 'var(--crai-fg)',
          border: '1px solid var(--crai-border)',
        }}>
        {children}
      </code>
    )
  },
  pre: ({ children }: any) => <>{children}</>,

  // 段落
  p: ({ children }: any) => <p className="my-2 leading-relaxed text-sm">{children}</p>,

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
  h1: ({ children }: any) => <h1 className="text-base font-bold mt-5 mb-3">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-4 mb-2">{children}</h3>,

  // 表格
  table: ({ children }: any) => (
    <div className="my-3 overflow-x-auto rounded border" style={{ borderColor: 'var(--crai-border)' }}>
      <table className="min-w-full text-sm divide-y" style={{ borderColor: 'var(--crai-border)' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead style={{ backgroundColor: 'var(--crai-bg-tertiary)' }}>{children}</thead>,
  th: ({ children }: any) => <th className="text-left py-2 px-3 font-semibold text-xs">{children}</th>,
  td: ({ children }: any) => <td className="py-2 px-3 text-xs border-t" style={{ borderColor: 'var(--crai-border)' }}>{children}</td>,

  // 引用
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 pl-3 my-2 text-xs"
      style={{
        borderColor: 'var(--crai-accent)',
        color: 'var(--crai-fg-secondary)',
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
      style={{ color: 'var(--crai-accent)' }}
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
