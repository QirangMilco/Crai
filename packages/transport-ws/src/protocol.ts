/**
 * @crai/transport-ws — WebSocket 传输层协议定义。
 *
 * 所有消息均为 UTF-8 JSON 文本帧。
 */

// ── Client → Server ───────────────────────────────

/** 客户端向 runtime 发送 prompt。 */
export interface PromptMessage {
  type: 'prompt'
  /** 目标 session，不传则使用上一个或创建新 session。 */
  sessionId?: string
  /** 用户输入文本。 */
  text: string
}

/** 客户端请求创建新 session。 */
export interface SessionNewMessage {
  type: 'session:new'
  system?: string
}

/** 客户端回复 runtime 的提问（权限确认 / 工具提问）。 */
export interface ResolveInputMessage {
  type: 'resolve:input'
  /** 对应 request:input 的 id。 */
  id: string
  /** 用户输入的值。 */
  value: string
}

export type ClientMessage = PromptMessage | SessionNewMessage | ResolveInputMessage

// ── Server → Client ───────────────────────────────

/** runtime 事件的实时转发。 */
export interface EventMessage {
  type: 'event'
  /** 事件名（如 "model.delta"）。 */
  event: string
  /** 事件负载。 */
  payload: unknown
}

/** runtime 向用户提问（权限确认 / 工具提问）。 */
export interface RequestInputMessage {
  type: 'request:input'
  /** 请求标识（客户端回复时原样返回）。 */
  id: string
  /** 问题描述。 */
  question: string
  /** 可选选项列表。为空时自由输入。 */
  options?: string[]
}

/** 当前 session ID 通知。 */
export interface SessionIdMessage {
  type: 'session:id'
  /** 当前 session ID。 */
  id: string
}

/** 服务端错误通知。 */
export interface ErrorMessage {
  type: 'error'
  message: string
}

export type ServerMessage = EventMessage | RequestInputMessage | SessionIdMessage | ErrorMessage
