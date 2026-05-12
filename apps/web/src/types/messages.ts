/** 与 transport-ws 通信的消息类型。 */

// ── Server → Client ──

export interface EventMsg {
  type: 'event'
  event: string
  payload: unknown
}

export interface RequestInputMsg {
  type: 'request:input'
  id: string
  question: string
  options?: string[]
}

export interface SessionIdMsg {
  type: 'session:id'
  id: string
}

export interface ErrorMsg {
  type: 'error'
  message: string
}

export type ServerMsg = EventMsg | RequestInputMsg | SessionIdMsg | ErrorMsg

// ── Client → Server ──

export interface PromptMsg {
  type: 'prompt'
  sessionId?: string
  text: string
}

export interface SessionNewMsg {
  type: 'session:new'
  system?: string
}

export interface ResolveInputMsg {
  type: 'resolve:input'
  id: string
  value: string
}

export type ClientMsg = PromptMsg | SessionNewMsg | ResolveInputMsg

// ── 内部消息模型 ──

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
}
