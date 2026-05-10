import type { ModelContext, Message, Session, ToolDefinition, Metadata } from '@crai/core'

/** 将 session.metadata.system 提取到 context.system。 */
function extractSystem(meta: Metadata | undefined): string | undefined {
  if (meta && typeof meta === 'object' && 'system' in meta) {
    const s = (meta as Record<string, unknown>).system
    return typeof s === 'string' ? s : undefined
  }
  return undefined
}

/** 构建最小模型上下文。只做数据拼装，不引入任何 provider 细节。 */
export function buildRuntimeContext(params: {
  session: Session
  messages: Message[]
  tools: ToolDefinition[]
}): ModelContext {
  return {
    system: extractSystem(params.session.metadata),
    messages: params.messages,
    tools: params.tools,
    metadata: params.session.metadata,
  }
}
