import { Component, type ReactNode } from 'react'
import { Icon } from './ui/Icon'
import { AlertCircle } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
          style={{ color: 'var(--crai-fg-tertiary)' }}>
          <Icon icon={AlertCircle} size="lg" />
          <span className="text-sm font-medium">组件渲染异常</span>
          <span className="text-xs max-w-md opacity-60">{this.state.error?.message}</span>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 rounded text-xs"
            style={{ backgroundColor: 'var(--crai-bg-5)', color: 'var(--crai-fg)' }}
          >重试</button>
        </div>
      )
    }
    return this.props.children
  }
}
