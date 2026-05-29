import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  onError?: (error: Error) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="h-dvh flex items-center justify-center flex-col gap-4 px-4"
          style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}
        >
          <div className="text-base font-semibold" style={{ color: 'var(--crai-destructive)' }}>
            渲染异常
          </div>
          <div
            className="text-xs max-w-md text-center leading-relaxed"
            style={{ color: 'var(--crai-fg-secondary)' }}
          >
            {this.state.error?.message ?? '未知错误'}
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-1.5 rounded text-xs font-medium text-white mt-2"
            style={{ backgroundColor: 'var(--crai-accent)' }}
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
