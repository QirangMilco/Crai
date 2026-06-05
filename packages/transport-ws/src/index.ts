/**
 * @crai/transport-ws — WebSocket transport for Crai runtime.
 */
import type { Extension, Logger, RuntimeHandle } from '@crai/core'
import { DEBUG_SCOPES, debugLog, EVENTS, createId } from '@crai/core'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from './protocol'
import type { GlobalConfig, ProviderConfig, WorkspaceConfig } from '@crai/core'
import { browseDir } from './dir-browse'
import { buildActivitiesFromParts, extractResponseText } from './parts-utils'

export type { ClientMessage, ServerMessage } from './protocol'
export { browseDir } from './dir-browse'

// ── 选项 ───────────────────────────────────────────

export interface WsTransportHandlers {
  onConfigGet?: () => GlobalConfig | Promise<GlobalConfig>
  onConfigSet?: (config: GlobalConfig) => void | Promise<void>
  onConfigSetProvider?: (name: string, config: ProviderConfig) => void | Promise<void>
  onConfigRemoveProvider?: (name: string) => void | Promise<void>
  onConfigFetchModels?: (providerName: string) => Promise<{ models: string[]; error?: string }>
  /** 测试 provider 连接。返回 ok 表示连接成功，error 为失败原因。 */
  onConfigTest?: (providerName: string) => Promise<{ ok: boolean; error?: string }>
  /** 返回已知模型信息和第一方 provider 列表。 */
  onConfigKnownModels?: () => Promise<{
    firstParty: Array<{ name: string; label: string; defaultBaseURL: string }>
    knownModels: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>
    thinkingLevels: Record<string, string[]>
  }>
  /** 获取访问密钥列表。返回不含原始 token 的密钥信息。 */
  onAuthListKeys?: () => Array<{ id: string; description: string; createdAt: string; lastUsedAt: string | null; status: string }>
  /** 生成新的访问密钥。返回原始 token（仅此一次可见）和密钥信息。 */
  onAuthGenerateKey?: (description: string) => { rawToken: string; info: { id: string; description: string; createdAt: string; lastUsedAt: string | null; status: string } }
  /** 吊销一个访问密钥。 */
  onAuthRevokeKey?: (id: string) => void
  onWorkspaceList?: () => Array<{ rootDir: string; config: WorkspaceConfig }> | Promise<Array<{ rootDir: string; config: WorkspaceConfig }>>
  onWorkspaceSwitch?: (rootDir: string) => Promise<{ model: string; provider: string }>
  onWorkspaceConfigGet?: (rootDir: string) => WorkspaceConfig | Promise<WorkspaceConfig>
  onWorkspaceConfigSet?: (rootDir: string, config: WorkspaceConfig) => void | Promise<void>

  // ── 检查点操作 ──
  /** 列出会话的检查点。 */
  onCheckpointList?: (sessionId: string) => Promise<Array<{ turnId: string; messageCount: number; timestamp: number; fileCount: number }>>
  /** 回滚到指定检查点。返回截断后的消息数，或 null。 */
  onCheckpointRollback?: (sessionId: string, turnId: string) => Promise<number | null>
  /** 回滚到指定消息索引处的文件状态。返回截断后的消息数。 */
  onCheckpointRollbackToIndex?: (sessionId: string, messageIndex: number) => Promise<{ messageCount: number; filesRestored: number } | null>
  /** 获取回滚点列表（每消息快照信息）。 */
  onCheckpointRollbackPoints?: (sessionId: string) => Promise<Array<{ messageIndex: number; turnId: string; fileCount: number; timestamp: number }>>
  /** 从检查点分叉出新会话。返回新会话 ID，或 null。 */
  onCheckpointFork?: (sessionId: string, turnId: string, newSessionId: string) => Promise<string | null>
}

export interface WsTransportOptions {
  port?: number
  host?: string
  onReady?: (info: { port: number; url: string }) => void
  onConnectionChange?: (count: number) => void
  handlers?: WsTransportHandlers
  /** 根据工作区路径获取对应的 runtime。没有 API key 时可能为 undefined。 */
  getRuntime?: (rootDir: string) => RuntimeHandle | undefined
  /**
   * WebSocket 连接鉴权。返回匹配的密钥 ID 或 null（拒绝）。
   * 如果未设置，则跳过鉴权（兼容本地开发）。
   */
  verifyToken?: (token: string) => string | null
  /** 日志记录器，调试输出受 logLevel 过滤。 */
  logger?: Logger
}

// ── 返回接口 ───────────────────────────────────────

export interface WsTransport {
  extension: Extension
  start: () => Promise<{ port: number; url: string }>
  stop: () => Promise<void>
  requestUserInput: (question: string, options?: string[], meta?: Record<string, unknown>) => Promise<string>
  /** 发布来自任意 workspace 的事件到所有客户端。事件消息中会带 workspaceId。 */
  publishEvent: (workspaceId: string, event: string, payload: unknown) => void
  /** 吊销密钥：关闭所有使用该密钥的连接。 */
  revokeKey?: (keyId: string) => void
}

// ── Factory ────────────────────────────────────────

export function createWsTransport(options: WsTransportOptions = {}): WsTransport {
  const { host = '0.0.0.0', port: preferredPort = 0, handlers, getRuntime, logger } = options
  const httpServer = http.createServer()
  const wss = new WebSocketServer({ server: httpServer })
  const clients = new Set<WebSocket>()
  const pendingInputs = new Map<string, { resolve: (value: string) => void }>()
  /** 当前正在处理的 prompt 及其 AbortController，按 runtime id 索引。 */
  const currentPromptAbort = new Map<string, AbortController>()

  let currentSessionId: string | undefined
  let currentWorkspace: string | undefined

  function resolveRuntime(): RuntimeHandle | undefined {
    if (getRuntime) {
      if (currentWorkspace) return getRuntime(currentWorkspace)
      // 没有设置当前工作区时，让 getRuntime 自己处理（服务端可返回第一个 runtime）
      return getRuntime('')
    }
    return undefined
  }

  function broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg)
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(json)
    }
  }

  async function handleClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    // ── 不需要 runtime 的消息（配置、工作区，session:list 无 runtime 时也接受），放行通过 ──
    switch (msg.type) {
      case 'config:get':
      case 'config:set':
      case 'config:set:provider':
      case 'config:remove:provider':
      case 'config:fetch:models':
      case 'config:test':
      case 'config:known-models':
      case 'config:auth:list':
      case 'config:auth:generate':
      case 'config:auth:revoke':
      case 'workspace:list':
      case 'workspace:switch':
      case 'workspace:config:get':
      case 'workspace:config:set':
      case 'session:list':
      case 'dir:browse':
        break
      default: {
        const rt = resolveRuntime()
        if (!rt) {
          ws.send(JSON.stringify({ type: 'error', message: 'runtime not ready' } satisfies ServerMessage))
          return
        }
      }
    }

    switch (msg.type) {
      case 'prompt': {
        const rt = resolveRuntime()!
        const opts: any = {}
        // 创建当前 prompt 的 AbortController，使 session:cancel-turn 能立即中止
        const abortCtrl = new AbortController()
        const targetId = msg.sessionId || currentSessionId || 'pending'
        currentPromptAbort.set(rt.id, abortCtrl)
        opts.signal = abortCtrl.signal

        // 先确保 session 存在，再开始流式任务。
        // 这样 session:id 能在 streaming 事件到达客户端之前送达，
        // 避免 model.completed 到达时 sessionIdRef 仍为 null。
        let sessionId: string | undefined
        if (msg.forceNewSession) {
          // 客户端要求创建新会话
          const newSession = await rt.createSession()
          currentSessionId = newSession.id
          sessionId = currentSessionId
          opts.sessionId = sessionId
          ws.send(JSON.stringify({ type: 'session:id', id: sessionId } satisfies ServerMessage))
        } else {
          sessionId = msg.sessionId || currentSessionId
          if (!sessionId) {
            const newSession = await rt.createSession()
            currentSessionId = newSession.id
            opts.sessionId = currentSessionId
            // 设置初始标题为用户第一条消息的截断
            const initialTitle = msg.text && msg.text.trim() ? msg.text.trim().slice(0, 60) : undefined
            if (initialTitle) {
              await rt.updateSession({ ...newSession, title: initialTitle, updatedAt: Date.now() })
            }
            ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
          } else {
            opts.sessionId = sessionId
          }
        }
        // 在 prompt 中携带思考深度和模式
        if (msg.thinkingLevel !== undefined) opts.thinkingLevel = msg.thinkingLevel
        if (msg.mode !== undefined) opts.mode = msg.mode
        // 模型格式：provider/model（如 "deepseek/deepseek-v4-flash"），兼容无前缀的裸名
        if (msg.model) {
          const slashIdx = msg.model.indexOf('/')
          if (slashIdx >= 0) {
            opts.provider = msg.model.slice(0, slashIdx)
            opts.model = msg.model.slice(slashIdx + 1)
          } else {
            opts.model = msg.model
          }
        }
        if (msg.provider) opts.provider = msg.provider
        // 从全局配置读取工具模型（原始格式：provider/model，如 "deepseek/deepseek-v4-flash"）
        try {
          const cfg = handlers?.onConfigGet ? await handlers.onConfigGet() : undefined
          if (cfg) {
            if ((cfg as any).toolModel) opts.toolModel = (cfg as any).toolModel
            // 压缩阈值和保留 token 数
            if ((cfg as any).compressionThreshold != null) opts.compressionThreshold = (cfg as any).compressionThreshold
            if ((cfg as any).keepRecentTokens != null) opts.compressionKeepTokens = (cfg as any).keepRecentTokens
          }
        } catch { /* 静默 */ }
        const result = await rt.prompt({ type: 'text', text: msg.text }, opts)
        // prompt 完成，清除 AbortController
        currentPromptAbort.delete(rt.id)
        // 发送更新后的会话数据（含 TODO 列表）
        ws.send(JSON.stringify({
          type: 'session:data',
          sessionId: result.session.id,
          messages: [],
          todos: result.session.todos,
          metadata: result.session.metadata,
          usageAccumulated: result.session.usageAccumulated,
          lastRoundUsage: (result.session.metadata as any)?.lastRoundUsage,
        } satisfies ServerMessage))
        if (!sessionId) {
          // 新 session 的 session:id 已在上面发送，这里不需要重复发
          // 但需要更新 currentSessionId（已在上面设置）
        } else {
          currentSessionId = result.session.id
        }
        break
      }

      case 'session:new': {
        const rt = resolveRuntime()!
        const session = await rt.createSession(msg.system ? { system: msg.system } : undefined)
        currentSessionId = session.id
        logger?.info(`已创建 session ${session.id}`)
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'resolve:input': {
        const p = pendingInputs.get(msg.id)
        if (p) { p.resolve(msg.value); pendingInputs.delete(msg.id) }
        break
      }

      case 'session:list': {
        const rt = resolveRuntime()
        if (!rt) {
          // 没有 runtime（未配置 provider）时返回空列表而非报错
          ws.send(JSON.stringify({ type: 'session:list:data', sessions: [] } satisfies ServerMessage))
          break
        }
        const sessions = await rt.listSessions()
        ws.send(JSON.stringify({ type: 'session:list:data', sessions } satisfies ServerMessage))
        break
      }

      case 'session:load': {
        const rt = resolveRuntime()!
        let raw = await rt.listMessages(msg.sessionId)
        const session = await rt.getSession(msg.sessionId)

        // 合并同一次回复中多轮 assistant 消息的 parts
        // 同一 turn 内的思考+工具+正文分属 asst0、asst1 等，中间隔了 tool 消息
        // 需要跳过 tool 消息回溯到上一个 assistant 来合并
        const mergedRaw: typeof raw = []
        for (const m of raw) {
          if (m.role === 'assistant') {
            // 从 mergedRaw 末尾跳过 tool 消息找上一个 assistant
            let backIdx = mergedRaw.length - 1
            while (backIdx >= 0 && mergedRaw[backIdx]?.role === 'tool') backIdx--
            const lastAsst = mergedRaw[backIdx]
            if (lastAsst?.role === 'assistant') {
              lastAsst.parts.push(...m.parts)
              continue
            }
          }
          mergedRaw.push(m)
        }
        raw = mergedRaw
        debugLog(DEBUG_SCOPES.MIDDLEWARE, `session:load merge result: ${raw.length} msgs (${raw.filter(m => m.role === 'assistant').length} asst, ${raw.filter(m => m.role === 'tool').length} tool)`, { sessionId: msg.sessionId }, logger)

        // 将内部 Message（parts 格式）转为客户端格式
        const messages = raw
          .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system' || m.role === 'tool')
          .map((m) => {
            const text = m.role === 'tool' ? '' : extractResponseText(m.parts)
            if (m.role === 'assistant') {
              debugLog(DEBUG_SCOPES.MIDDLEWARE, `session:load asst text="${text.substring(0, 60)}" (parts=${m.parts.length})`, { sessionId: msg.sessionId, partTypes: m.parts.map((p: any) => p.type) }, logger)
            }
            return {
            id: m.id,
            role: m.role,
            text,
            createdAt: m.createdAt,
            metadata: (m as any).metadata,
            activities: m.role === 'assistant' ? buildActivitiesFromParts(m.parts, (m as any).stopReason) : undefined,
            // tool-role 消息标记，前端用于把结果合并到对应 activity
            toolCallId: m.role === 'tool' ? (m as any).toolCallId : undefined,
            toolName: m.role === 'tool' ? (m as any).toolName : undefined,
            isError: m.role === 'tool' ? (m as any).isError : undefined,
            toolResult: m.role === 'tool' ? m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : undefined,
          }
          })

        // 将 tool 消息的结果合并到对应 assistant 消息的 activities 中
        const assistantMsgs = messages.filter((m: any) => m.role === 'assistant')
        const toolMsgs = messages.filter((m: any) => m.role === 'tool')
        for (const asst of assistantMsgs) {
          if (!asst.activities) continue
          for (const act of asst.activities) {
            const toolMsg = toolMsgs.find((t: any) => t.toolCallId === act.toolCallId)
            if (toolMsg) {
              act.content = toolMsg.toolResult || act.content
              if (toolMsg.isError) act.status = 'error'
            }
          }
        }
        // 去掉 tool 消息（前端只渲染 assistant + user + system）
        const filteredMessages = messages.filter((m: any) => m.role !== 'tool').map((m: any) => {
          const { toolCallId, toolName, isError, toolResult, ...rest } = m
          return rest
        })
        ws.send(JSON.stringify({
          type: 'session:data',
          sessionId: msg.sessionId,
          messages: filteredMessages,
          metadata: session?.metadata,
          todos: session?.todos,
          usageAccumulated: session?.usageAccumulated,
          lastRoundUsage: (session?.metadata as any)?.lastRoundUsage,
        } satisfies ServerMessage))
        break
      }

      // ── session:generate-title ──

      case 'session:generate-title': {
        const rt = resolveRuntime()!
        logger?.info(`正在为 session ${msg.sessionId} 生成标题`)
        // 获取 session 消息
        const raw = await rt.listMessages(msg.sessionId)
        const userMsg = raw.find((m: any) => m.role === 'user')?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        const aiMsg = raw.filter((m: any) => m.role === 'assistant').pop()?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        debugLog(DEBUG_SCOPES.TITLE_GEN, 'start', { sessionId: msg.sessionId, messagesFound: !!userMsg }, logger)
        if (!userMsg) { ws.send(JSON.stringify({ type: 'error', message: 'no messages to summarize' } satisfies ServerMessage)); break }

        // 查找工具模型配置（格式：provider/model）
        let toolModel: string | undefined
        let toolProvider: string | undefined
        try {
          const cfg = handlers?.onConfigGet ? await handlers.onConfigGet() : undefined
          if (cfg) {
            const tm = (cfg as any).toolModel ?? (cfg as any).defaultModel ?? undefined
            if (tm) {
              const si = tm.indexOf('/')
              if (si >= 0) {
                toolProvider = tm.slice(0, si)
                toolModel = tm.slice(si + 1)
              } else {
                toolModel = tm
              }
            }
          }
        } catch { /* 静默回退到默认模型 */ }
        debugLog(DEBUG_SCOPES.TITLE_GEN, 'model', { toolModel, toolProvider }, logger)

        try {
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'calling', { model: toolModel, provider: toolProvider }, logger)
          const title = await rt.callModel(
            [
              { role: 'user', content: userMsg.slice(0, 500) },
              ...(aiMsg ? [{ role: 'assistant', content: aiMsg.slice(0, 500) }] : []),
            ],
            {
              system: '用一句简短的话概括这个对话的主题。直接输出标题，不要前缀，不要引号，不要标点结尾。15字以内。',
              model: toolModel,
              provider: toolProvider,
              temperature: 0.3,
              maxTokens: 50,
              utility: true,
            },
          )
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'raw_response', { raw: title }, logger)
          const cleanTitle = title.replace(/^[""''“”「」]+|[""''“”」」]+$/g, '').trim()
          if (cleanTitle) {
            // 持久化标题
            const session = await rt.getSession(msg.sessionId)
            if (session) {
              await rt.updateSession({ ...session, title: cleanTitle, updatedAt: Date.now() })
            }
            logger?.info(`标题生成成功: ${cleanTitle}`)
            debugLog(DEBUG_SCOPES.TITLE_GEN, 'success', { title: cleanTitle }, logger)
            ws.send(JSON.stringify({ type: 'session:title', sessionId: msg.sessionId, title: cleanTitle } satisfies ServerMessage))
          }
        } catch (err: any) {
          logger?.warn(`标题生成失败: ${err.message}`)
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'error', { message: err.message }, logger)
          ws.send(JSON.stringify({ type: 'error', message: `title generation failed: ${err.message}` } satisfies ServerMessage))
        }
        break
      }

      case 'session:update': {
        const rt = resolveRuntime()!
        const session = await rt.getSession(msg.sessionId)
        if (session) {
          const metadata = { ...session.metadata }
          if (msg.thinkingLevel !== undefined) metadata.thinkingLevel = msg.thinkingLevel
          if (msg.mode !== undefined) metadata.mode = msg.mode
          const updated = {
            ...session,
            title: msg.title ?? session.title,
            pinned: msg.pinned !== undefined ? msg.pinned : session.pinned,
            archived: msg.archived !== undefined ? msg.archived : session.archived,
            metadata,
            updatedAt: Date.now(),
          }
          const changed = []
          if (msg.title !== undefined) changed.push(`标题: ${(msg.title ?? '(清空)').slice(0, 40)}`)
          if (msg.thinkingLevel !== undefined) changed.push(`思考深度: ${msg.thinkingLevel}`)
          if (msg.mode !== undefined) changed.push(`模式: ${msg.mode}`)
          if (msg.pinned !== undefined) changed.push(msg.pinned ? '已置顶' : '取消置顶')
          if (msg.archived !== undefined) changed.push(msg.archived ? '已归档' : '取消归档')
          logger?.info(`已更新 session ${msg.sessionId}: ${changed.join(', ')}`)
          await rt.updateSession(updated)
        }
        const sessions = await rt.listSessions()
        ws.send(JSON.stringify({ type: 'session:list:data', sessions } satisfies ServerMessage))
        break
      }

      case 'session:delete': {
        const rt = resolveRuntime()
        if (!rt) { ws.send(JSON.stringify({ type: 'error', message: 'runtime not ready' } satisfies ServerMessage)); break }
        debugLog(DEBUG_SCOPES.MIDDLEWARE, `session:delete ${msg.sessionId}`, { sessionId: msg.sessionId }, logger)
        await rt.deleteSession(msg.sessionId)
        logger?.info(`已删除 session ${msg.sessionId}`)
        const updatedSessions = await rt.listSessions()
        ws.send(JSON.stringify({ type: 'session:list:data', sessions: updatedSessions } satisfies ServerMessage))
        break
      }

      case 'session:cancel-turn': {
        const rt = resolveRuntime()
        if (!rt) { ws.send(JSON.stringify({ type: 'error', message: 'runtime not ready' } satisfies ServerMessage)); break }
        debugLog(DEBUG_SCOPES.MIDDLEWARE, `session:cancel-turn`, {}, logger)
        // 优先使用 transport 层的 AbortController（在 prompt 消息到达时已创建）
        const ctrl = currentPromptAbort.get(rt.id)
        debugLog(DEBUG_SCOPES.ABORT, `cancel-turn: found ctrl=${!!ctrl}, rtId=${rt.id}`, { hasCtrl: !!ctrl }, logger)
        if (ctrl) {
          ctrl.abort()
          debugLog(DEBUG_SCOPES.ABORT, 'cancel-turn: ctrl.abort() called', {}, logger)
          currentPromptAbort.delete(rt.id)
        }
        // 同时通知 runtime 层
        rt.abortCurrentTurn()
        break
      }

      // ── 目录浏览（不需要 runtime） ──

      case 'dir:browse': {
        const result = browseDir(msg.path, { showFiles: msg.showFiles })
        ws.send(JSON.stringify({ type: 'dir:browse:data', ...result } satisfies ServerMessage))
        break
      }

      // ── 配置 / 工作区消息（委托给 handlers） ──

      case 'config:get': {
        if (!handlers?.onConfigGet) { ws.send(JSON.stringify({ type: 'error', message: 'config not available' } satisfies ServerMessage)); break }
        const cfg = await handlers.onConfigGet()
        ws.send(JSON.stringify({ type: 'config:data', config: cfg } satisfies ServerMessage))
        break
      }

      case 'config:set': {
        if (!handlers?.onConfigSet) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        await handlers.onConfigSet(msg.config)
        // 返回更新后的配置
        const updatedCfg = await handlers.onConfigGet?.()
        if (updatedCfg) ws.send(JSON.stringify({ type: 'config:data', config: updatedCfg } satisfies ServerMessage))
        break
      }

      case 'config:set:provider': {
        if (!handlers?.onConfigSetProvider) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        try {
          await handlers.onConfigSetProvider(msg.name, msg.config)
        } catch (err) {
          logger?.error?.(`设置 provider 失败: ${(err as Error).message}`)
        }
        // 总是返回最新配置（即使保存失败也要同步内存状态）
        const refreshedCfg = await handlers.onConfigGet?.()
        if (refreshedCfg) ws.send(JSON.stringify({ type: 'config:data', config: refreshedCfg } satisfies ServerMessage))
        break
      }

      case 'config:remove:provider': {
        if (!handlers?.onConfigRemoveProvider) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        await handlers.onConfigRemoveProvider(msg.name)
        const refreshedCfg2 = await handlers.onConfigGet?.()
        if (refreshedCfg2) ws.send(JSON.stringify({ type: 'config:data', config: refreshedCfg2 } satisfies ServerMessage))
        break
      }

      case 'config:fetch:models': {
        if (!handlers?.onConfigFetchModels) { ws.send(JSON.stringify({ type: 'error', message: 'model fetching not available' } satisfies ServerMessage)); break }
        const result = await handlers.onConfigFetchModels(msg.providerName)
        ws.send(JSON.stringify({ type: 'config:models:data', providerName: msg.providerName, ...result } satisfies ServerMessage))
        break
      }

      case 'config:test': {
        if (!handlers?.onConfigTest) { ws.send(JSON.stringify({ type: 'error', message: 'config test not available' } satisfies ServerMessage)); break }
        const testResult = await handlers.onConfigTest(msg.providerName)
        ws.send(JSON.stringify({ type: 'config:test:result', ...testResult } satisfies ServerMessage))
        break
      }

      case 'config:known-models': {
        if (!handlers?.onConfigKnownModels) { ws.send(JSON.stringify({ type: 'error', message: 'known models not available' } satisfies ServerMessage)); break }
        const data = await handlers.onConfigKnownModels()
        ws.send(JSON.stringify({ type: 'config:known-models:data', ...data } satisfies ServerMessage))
        break
      }

      case 'config:auth:list': {
        if (!handlers?.onAuthListKeys) { ws.send(JSON.stringify({ type: 'error', message: 'auth not available' } satisfies ServerMessage)); break }
        const keys = handlers.onAuthListKeys()
        ws.send(JSON.stringify({ type: 'config:auth:list:data', keys } satisfies ServerMessage))
        break
      }

      case 'config:auth:generate': {
        if (!handlers?.onAuthGenerateKey) { ws.send(JSON.stringify({ type: 'error', message: 'auth not available' } satisfies ServerMessage)); break }
        const result = handlers.onAuthGenerateKey(msg.description)
        ws.send(JSON.stringify({ type: 'config:auth:generated', ...result } satisfies ServerMessage))
        break
      }

      case 'config:auth:revoke': {
        if (!handlers?.onAuthRevokeKey) { ws.send(JSON.stringify({ type: 'error', message: 'auth not available' } satisfies ServerMessage)); break }
        handlers.onAuthRevokeKey(msg.id)
        // 吊销后主动断开使用该密钥的连接
        for (const [ws, keyId] of connKeyIds) {
          if (keyId === msg.id) ws.close(4001, 'key revoked')
        }
        ws.send(JSON.stringify({ type: 'config:auth:revoked', id: msg.id } satisfies ServerMessage))
        break
      }

      // ── 检查点操作 ──
      case 'checkpoint:list': {
        if (!handlers?.onCheckpointList) { ws.send(JSON.stringify({ type: 'error', message: 'checkpoint not available' } satisfies ServerMessage)); break }
        const list = await handlers.onCheckpointList(msg.sessionId)
        ws.send(JSON.stringify({ type: 'checkpoint:list:data', sessionId: msg.sessionId, checkpoints: list } satisfies ServerMessage))
        break
      }
      case 'checkpoint:rollback': {
        if (!handlers?.onCheckpointRollback) { ws.send(JSON.stringify({ type: 'error', message: 'checkpoint not available' } satisfies ServerMessage)); break }
        const msgCount = await handlers.onCheckpointRollback(msg.sessionId, msg.turnId)
        ws.send(JSON.stringify({ type: 'checkpoint:rollback:done', sessionId: msg.sessionId, turnId: msg.turnId, messageCount: msgCount } satisfies ServerMessage))
        break
      }
      case 'checkpoint:rollback:to-index': {
        if (!handlers?.onCheckpointRollbackToIndex) { ws.send(JSON.stringify({ type: 'error', message: 'checkpoint not available' } satisfies ServerMessage)); break }
        const rbResult = await handlers.onCheckpointRollbackToIndex(msg.sessionId, msg.messageIndex)
        ws.send(JSON.stringify({ type: 'checkpoint:rollback:done', sessionId: msg.sessionId, turnId: '', messageCount: rbResult?.messageCount ?? null, filesRestored: rbResult?.filesRestored ?? 0 } satisfies ServerMessage))
        break
      }
      case 'checkpoint:rollback:points': {
        if (!handlers?.onCheckpointRollbackPoints) { ws.send(JSON.stringify({ type: 'error', message: 'checkpoint not available' } satisfies ServerMessage)); break }
        const points = await handlers.onCheckpointRollbackPoints(msg.sessionId)
        ws.send(JSON.stringify({ type: 'checkpoint:rollback:points:data', sessionId: msg.sessionId, points } satisfies ServerMessage))
        break
      }
      case 'checkpoint:fork': {
        if (!handlers?.onCheckpointFork) { ws.send(JSON.stringify({ type: 'error', message: 'checkpoint not available' } satisfies ServerMessage)); break }
        const newId = await handlers.onCheckpointFork(msg.sessionId, msg.turnId, msg.newSessionId)
        if (newId) {
          ws.send(JSON.stringify({ type: 'session:id', id: newId } satisfies ServerMessage))
          ws.send(JSON.stringify({ type: 'checkpoint:fork:done', sessionId: msg.sessionId, turnId: msg.turnId, newSessionId: newId } satisfies ServerMessage))
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'fork failed' } satisfies ServerMessage))
        }
        break
      }

      case 'workspace:list': {
        if (!handlers?.onWorkspaceList) { ws.send(JSON.stringify({ type: 'error', message: 'workspace not available' } satisfies ServerMessage)); break }
        const workspaces = await handlers.onWorkspaceList()
        ws.send(JSON.stringify({ type: 'workspace:list:data', current: currentWorkspace ?? null, workspaces } satisfies ServerMessage))
        break
      }

      case 'workspace:switch': {
        if (!handlers?.onWorkspaceSwitch) { ws.send(JSON.stringify({ type: 'error', message: 'workspace switching not supported' } satisfies ServerMessage)); break }
        logger?.info(`正在切换到工作区 ${msg.rootDir}`)
        const info = await handlers.onWorkspaceSwitch(msg.rootDir)
        currentSessionId = undefined
        currentWorkspace = msg.rootDir
        ws.send(JSON.stringify({ type: 'workspace:switched', rootDir: msg.rootDir, ...info } satisfies ServerMessage))
        break
      }

      case 'workspace:config:get': {
        if (!handlers?.onWorkspaceConfigGet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not available' } satisfies ServerMessage)); break }
        const wc = await handlers.onWorkspaceConfigGet(currentWorkspace ?? process.cwd())
        ws.send(JSON.stringify({ type: 'workspace:config:data', config: wc } satisfies ServerMessage))
        break
      }

      case 'workspace:config:set': {
        if (!handlers?.onWorkspaceConfigSet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not writable' } satisfies ServerMessage)); break }
        await handlers.onWorkspaceConfigSet(currentWorkspace ?? process.cwd(), msg.config)
        break
      }
    }
  }

  // Token 鉴权 + 追踪连接使用的密钥
  const connKeyIds = new Map<WebSocket, string>()

  wss.on('connection', (ws, req) => {
    if (stopped) { ws.close(1001, 'Server shutting down'); return }

    if (options.verifyToken) {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      const token = url.searchParams.get('token') || ''
      if (!token) {
        ws.close(4001, 'token required')
        options.logger?.info(`WS 连接被拒绝：缺少 token (${req.socket.remoteAddress})`)
        return
      }
      const keyId = options.verifyToken(token)
      if (!keyId) {
        ws.close(4001, 'invalid token')
        options.logger?.info(`WS 连接被拒绝：token 无效 (${req.socket.remoteAddress})`)
        return
      }
      connKeyIds.set(ws, keyId)
    }

    clients.add(ws)
    options.onConnectionChange?.(clients.size)

    if (currentSessionId) {
      ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
    }

    ws.on('message', (data) => {
      const raw = String(data)
      let msg: ClientMessage
      try { msg = JSON.parse(raw) } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' } satisfies ServerMessage))
        return
      }
      handleClientMessage(ws, msg).catch((err) => {
        ws.send(JSON.stringify({ type: 'error', message: err.message ?? String(err) } satisfies ServerMessage))
      })
    })

    ws.on('close', () => {
      clients.delete(ws)
      connKeyIds.delete(ws)
      options.onConnectionChange?.(clients.size)
    })

    ws.on('error', () => ws.close())
  })

  let stopped = false

  const transport: WsTransport = {
    extension: {
      name: 'transport-ws',
      setup(ctx) {
        // 不再设置 runtime——改由 getRuntime 回调按当前工作区查询
        for (const key of Object.keys(EVENTS) as Array<keyof typeof EVENTS>) {
          const eventName = EVENTS[key]
          const handler = (event: any) => {
            const payload = event?.payload ?? event
            broadcast({ type: 'event', event: eventName, payload })
          }
          ctx.events.on(eventName, handler)
        }
        ctx.register({
          dispose: () => { /* cleanup handled by stop() */ },
        })
      },
    },

    async start() {
      return new Promise<{ port: number; url: string }>((resolve) => {
        httpServer.listen(preferredPort, host, () => {
          const addr = httpServer.address()
          const port = typeof addr === 'object' && addr ? addr.port : 0
          const info = { port, url: `ws://${host}:${port}` }
          options.onReady?.(info)
          resolve(info)
        })
      })
    },

    async stop() {
      stopped = true
      for (const ws of clients) ws.close(1001, 'Server shutting down')
      clients.clear()
      pendingInputs.clear()
      return new Promise<void>((resolve) => {
        wss.close(() => httpServer.close(() => resolve()))
      })
    },

    requestUserInput: async (question: string, options?: string[], meta?: Record<string, unknown>) => {
      const id = createId('req')
      return new Promise<string>((resolve) => {
        pendingInputs.set(id, { resolve })
        broadcast({ type: 'request:input', id, question, options, meta })
      })
    },

    publishEvent: (workspaceId: string, event: string, payload: unknown) => {
      if (event === 'thinking.delta' || event === 'thinking.done' || event === 'tool.start' || event === 'tool.delta' || event === 'tool.done' || event === 'activity.start' || event === 'activity.delta' || event === 'activity.done') {
        debugLog(DEBUG_SCOPES.API, `ws broadcast: ${event}`, { workspaceId, hasPayload: !!payload }, logger)
      }
      broadcast({ type: 'event', event, payload: { workspaceId, ...(typeof payload === 'object' && payload !== null ? payload : {}) } })
    },

    revokeKey: (keyId: string) => {
      // 关闭所有使用该密钥的 WebSocket 连接
      for (const [ws, id] of connKeyIds) {
        if (id === keyId) {
          ws.close(4001, 'key revoked')
        }
      }
    },
  }

  return transport
}
