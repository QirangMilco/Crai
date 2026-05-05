import type { ModelContext, Message, Session, ToolDefinition } from '../../core/src'

/**
 * 构建最小模型上下文。
 * 这里只做纯数据拼装，不引入任何 provider 细节。
 */
export function buildRuntimeContext(params: {
  session: Session
  messages: Message[]
  tools: ToolDefinition[]
}): ModelContext {
  return {
    messages: params.messages,
    tools: params.tools,
    metadata: params.session.metadata,
  }
}
