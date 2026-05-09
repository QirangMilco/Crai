import type { ModelContext, Message, Session, ToolDefinition } from '@crai/core'

/** 构建最小模型上下文。只做数据拼装，不引入任何 provider 细节。 */
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
