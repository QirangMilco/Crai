/**
 * CheckpointManager — 会话级别检查点管理。
 *
 * 每个 turn 开始时创建一个检查点，记录当前消息数和被修改文件原始内容。
 * 检查点保留以支持回滚到任意历史消息。使用 prune() 定期清理。
 *
 * Snow-CLI 对齐的功能：
 * - rollbackToMessageIndex — 回滚到指定消息索引（含对齐优化）
 * - getRollbackPoints — 返回每消息的快照信息（前端可视化用）
 * - 回滚模式：仅文件 / 仅对话 / 两者（由调用方控制）
 */

import { promises as fs } from 'node:fs'
import { resolve, dirname } from 'node:path'

// ── 类型 ─────────────────────────────────────────────

export interface CheckpointFileEntry {
  path: string
  content: string | null
}

export interface Checkpoint {
  sessionId: string
  turnId: string
  messageCount: number
  timestamp: number
  files: CheckpointFileEntry[]
}

/** 回滚点：每个消息索引对应的快照信息。 */
export interface RollbackPoint {
  messageIndex: number
  turnId: string
  fileCount: number
  timestamp: number
}

/** 回滚结果。 */
export interface RollbackResult {
  messageCount: number
  filesRestored: number
}

interface MessageLike {
  id: string
  role: string
  parts: { type: string; text?: string }[]
  createdAt: number
}

// ── 检查点管理器 ────────────────────────────────────

export class CheckpointManager {
  private checkpointsDir: string

  constructor(checkpointsDir: string) {
    this.checkpointsDir = checkpointsDir
  }

  private checkpointPath(sessionId: string, turnId: string): string {
    return resolve(this.checkpointsDir, `${sessionId}_${turnId}.json`)
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.checkpointsDir, { recursive: true })
  }

  private async save(cp: Checkpoint): Promise<void> {
    await fs.writeFile(this.checkpointPath(cp.sessionId, cp.turnId), JSON.stringify(cp, null, 2), 'utf-8')
  }

  // ── 生命周期 ──

  async create(sessionId: string, turnId: string, messageCount: number): Promise<void> {
    await this.ensureDir()
    await this.save({ sessionId, turnId, messageCount, timestamp: Date.now(), files: [] })
  }

  async recordFile(sessionId: string, turnId: string, filePath: string): Promise<void> {
    const cp = await this.load(sessionId, turnId)
    if (!cp || cp.files.some((f) => f.path === filePath)) return
    let content: string | null = null
    try { content = await fs.readFile(filePath, 'utf-8') } catch { content = null }
    cp.files.push({ path: filePath, content })
    await this.save(cp)
  }

  /** 标记 turn 完成。检查点保留。 */
  async complete(_sessionId: string, _turnId: string): Promise<void> {
    // no-op: checkpoint is kept
  }

  // ── 回滚 ──

  /** 回滚到指定 turn 的检查点。返回 messageCount。 */
  async rollback(sessionId: string, turnId: string): Promise<number | null> {
    const cp = await this.load(sessionId, turnId)
    if (!cp) return null
    await this.restoreFiles(cp)
    return cp.messageCount
  }

  /**
   * 回滚到指定消息索引。自动对齐最优检查点：
   * 优先选 messageCount ≤ targetIndex 的最接近检查点。
   * 返回 { messageCount, filesRestored } 或 null。
   */
  async rollbackToMessageIndex(sessionId: string, targetIndex: number): Promise<RollbackResult | null> {
    const all = await this.listCheckpoints(sessionId)
    const candidates = all.filter((c) => c.messageCount <= targetIndex)
    if (candidates.length === 0) return null
    const best = candidates[candidates.length - 1]

    const cp = await this.load(sessionId, best.turnId)
    if (!cp) return null

    await this.restoreFiles(cp)
    const filesRestored = cp.files.length

    // 清理失效检查点
    const invalid = all.filter((c) => c.messageCount > best.messageCount)
    for (const c of invalid) await this.clear(sessionId, c.turnId)

    return { messageCount: best.messageCount, filesRestored }
  }

  private async restoreFiles(cp: Checkpoint): Promise<void> {
    for (const entry of [...cp.files].reverse()) {
      try {
        if (entry.content !== null) {
          await fs.mkdir(dirname(entry.path), { recursive: true })
          await fs.writeFile(entry.path, entry.content, 'utf-8')
        } else {
          await fs.rm(entry.path, { force: true })
        }
      } catch (err) {
        console.error(`[checkpoint] 回滚文件失败: ${entry.path}`, err)
      }
    }
  }

  // ── 回滚点（前端快照可视化用） ──

  /**
   * 获取每个消息索引的回滚点信息。
   * 返回一个数组，每个元素对应一个消息索引，包含该索引是否有快照及文件数。
   * 前端据此显示哪些消息有可恢复的文件状态。
   */
  async getRollbackPoints(sessionId: string): Promise<RollbackPoint[]> {
    const checkpoints = await this.listCheckpoints(sessionId)
    const maxMsg = checkpoints.length > 0 ? Math.max(...checkpoints.map((c) => c.messageCount)) : 0
    const pointMap = new Map<number, RollbackPoint>()
    for (const cp of checkpoints) {
      pointMap.set(cp.messageCount, {
        messageIndex: cp.messageCount,
        turnId: cp.turnId,
        fileCount: cp.fileCount,
        timestamp: cp.timestamp,
      })
    }
    const result: RollbackPoint[] = []
    for (let i = 0; i <= maxMsg; i++) {
      const p = pointMap.get(i)
      result.push(p ?? { messageIndex: i, turnId: '', fileCount: 0, timestamp: 0 })
    }
    return result
  }

  // ── 分叉 ──

  async fork(
    sourceId: string, turnId: string, newSessionId: string,
    listMessages: (sid: string) => Promise<MessageLike[]>,
    createSession: (s: { id: string; createdAt: number; updatedAt: number }) => Promise<void>,
    appendMessage: (sid: string, msg: unknown) => Promise<void>,
  ): Promise<void> {
    const cp = await this.load(sourceId, turnId)
    if (!cp) throw new Error(`检查点未找到: ${sourceId}/${turnId}`)
    const msgs = await listMessages(sourceId)
    const keep = msgs.slice(0, cp.messageCount)
    const now = Date.now()
    await createSession({ id: newSessionId, createdAt: now, updatedAt: now })
    for (const msg of keep) await appendMessage(newSessionId, msg)
  }

  // ── 清理 ──

  async prune(sessionId: string, keepCount: number): Promise<void> {
    const all = await this.listCheckpoints(sessionId)
    const toDelete = all.slice(0, Math.max(0, all.length - keepCount))
    for (const c of toDelete) await this.clear(sessionId, c.turnId)
  }

  async clear(sessionId: string, turnId: string): Promise<void> {
    try { await fs.rm(this.checkpointPath(sessionId, turnId), { force: true }) } catch { }
  }

  // ── 查询 ──

  async load(sessionId: string, turnId: string): Promise<Checkpoint | null> {
    try {
      return JSON.parse(await fs.readFile(this.checkpointPath(sessionId, turnId), 'utf-8')) as Checkpoint
    } catch { return null }
  }

  async listCheckpoints(sessionId: string): Promise<{ turnId: string; messageCount: number; timestamp: number; fileCount: number }[]> {
    const results: { turnId: string; messageCount: number; timestamp: number; fileCount: number }[] = []
    try {
      const files = await fs.readdir(this.checkpointsDir)
      for (const file of files) {
        if (!file.startsWith(`${sessionId}_`) || !file.endsWith('.json')) continue
        const turnId = file.slice(sessionId.length + 1, -5)
        const cp = await this.load(sessionId, turnId)
        if (cp) results.push({ turnId: cp.turnId, messageCount: cp.messageCount, timestamp: cp.timestamp, fileCount: cp.files.length })
      }
    } catch { }
    results.sort((a, b) => a.timestamp - b.timestamp)
    return results
  }
}
