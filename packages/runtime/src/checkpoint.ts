/**
 * CheckpointManager — 会话级别检查点管理。
 *
 * 每个 turn 开始时创建一个检查点，记录当前消息数和被修改文件原始内容。
 * 检查点保留以支持回滚到任意历史消息。
 *
 * 设计文档：../../refs/version-management-design.md
 *
 * 变更记录：
 * - 2026-06: 新增 changeSource / diff / timestamp 字段
 * - 2026-06: 新增 getDiff / clearAll 方法
 * - 2026-06: parentTurnId / title / description 元数据
 */

import { promises as fs } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { diffLines } from 'diff'
import { debugLog } from '@crai/core'  // use CHECKPOINT scope

// ── 类型 ─────────────────────────────────────────────

export interface CheckpointFileEntry {
  path: string
  /** 修改前的文件全文。用于回滚时 O(1) 恢复。 */
  content: string | null
  /** unified diff（修改后版本相对于 content 的变化）。仅用于 UI 展示。 */
  diff?: string
  /** 变更来源 */
  changeSource: 'agent' | 'manual' | 'unknown'
  /** 快照时间 */
  timestamp: number
}

export interface Checkpoint {
  sessionId: string
  turnId: string
  messageCount: number
  timestamp: number
  files: CheckpointFileEntry[]
  /** 父节点 turnId，形成线性版本链 */
  parentTurnId?: string
  /** 版本节点标题 */
  title?: string
  /** 变更摘要 */
  description?: string
}

export interface RollbackPoint {
  messageIndex: number
  turnId: string
  fileCount: number
  timestamp: number
  filePaths?: string[]
  /** AI 工具修改的文件数（不含手动修改）。 */
  agentFileCount?: number
}

export interface RollbackResult {
  messageCount: number
  filesRestored: number
}

export interface DiffEntry {
  path: string
  diff: string
  changeSource: 'agent' | 'manual' | 'unknown'
  timestampA: number
  timestampB: number
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
  private excludePatterns: string[]
  /** 最新的 turnId 用于建立 parent 链 */
  private lastTurnId: string | null = null

  constructor(checkpointsDir: string, options?: { excludePatterns?: string[] }) {
    this.checkpointsDir = checkpointsDir
    this.excludePatterns = options?.excludePatterns ?? []
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

  /** 检查路径是否匹配排除规则（.craignore 模式）。 */
  private isExcluded(filePath: string): boolean {
    return this.excludePatterns.some((pattern) => filePath.includes(pattern))
  }

  private async readCurrentFileContent(filePath: string): Promise<string> {
    try {
      const c = await fs.readFile(filePath, 'utf-8')
      debugLog('checkpoint', 'readCurrentFileContent ok', { path: filePath, len: c.length, preview: c.slice(0, 50) })
      return c
    } catch (e) {
      debugLog('checkpoint', 'readCurrentFileContent error', { path: filePath, err: e instanceof Error ? e.message : String(e) })
      return ''
    }
  }

  /** 计算 unified diff（使用 diff 包的 Myers 算法，含 hunk 头）。
   *  如果 diff 包不可用，回退到简单 LCS 实现。 */
  private computeDiff(original: string, modified: string): string {
    const changes = diffLines(original, modified)

    // 展平为变更行序列
    interface Change { type: 'add' | 'del' | 'eq'; content: string }
    const allChanges: Change[] = []
    for (const part of changes) {
      const lines = part.value.replace(/\n$/, '').split('\n')
      const type = part.added ? 'add' as const : part.removed ? 'del' as const : 'eq' as const
      for (const line of lines) allChanges.push({ type, content: line })
    }

    // 分组为 hunks（3 行上下文）
    const CTX = 3
    const hunks: Change[][] = []
    let i = 0
    while (i < allChanges.length) {
      if (allChanges[i].type === 'eq') { i++; continue }
      const start = Math.max(0, i - CTX)
      let end = Math.min(allChanges.length - 1, i + CTX)
      while (end + 1 < allChanges.length) {
        const next = end + 1
        if (allChanges[next].type !== 'eq') { end = next; continue }
        let hasMore = false
        for (let k = next + 1; k < Math.min(allChanges.length, next + 1 + CTX * 2); k++) {
          if (allChanges[k].type !== 'eq') { hasMore = true; break }
        }
        if (hasMore) { end = next } else { break }
      }
      hunks.push(allChanges.slice(start, end + 1))
      i = end + 1
    }

    // 渲染 unified diff
    const result: string[] = []
    for (const hunk of hunks) {
      let oc = 0, nc = 0
      for (const op of hunk) {
        if (op.type !== 'add') oc++
        if (op.type !== 'del') nc++
      }
      const firstIdx = allChanges.indexOf(hunk[0])
      let so = 1, sn = 1
      for (let k = 0; k < firstIdx; k++) {
        if (allChanges[k].type !== 'add') so++
        if (allChanges[k].type !== 'del') sn++
      }
      result.push(`@@ -${so},${oc} +${sn},${nc} @@`)
      for (const op of hunk) {
        if (op.type === 'eq') result.push(' ' + op.content)
        else if (op.type === 'del') result.push('-' + op.content)
        else result.push('+' + op.content)
      }
    }
    return result.join('\n')
  }

  // ── 生命周期 ──

  async create(sessionId: string, turnId: string, messageCount: number): Promise<void> {
    await this.ensureDir()
    const cp: Checkpoint = {
      sessionId, turnId, messageCount,
      timestamp: Date.now(),
      files: [],
      parentTurnId: this.lastTurnId ?? undefined,
    }
    this.lastTurnId = turnId
    await this.save(cp)
  }

  async recordFile(
    sessionId: string, turnId: string, filePath: string,
    changeSource: 'agent' | 'manual' | 'unknown' = 'agent',
  ): Promise<void> {
    debugLog('checkpoint', 'recordFile', { filePath, turnId })
    if (this.isExcluded(filePath)) return
    const cp = await this.load(sessionId, turnId)
    if (!cp || cp.files.some((f) => f.path === filePath)) return

    // 读取文件原文（快照）
    let content: string | null = null
    try { content = await fs.readFile(filePath, 'utf-8') } catch { content = null; debugLog('checkpoint', 'recordFile: readFile failed', { path: filePath }) }
    debugLog('checkpoint', 'recordFile: content', { path: filePath, contentLen: content?.length ?? 0 })

    cp.files.push({
      path: filePath,
      content,
      changeSource,
      timestamp: Date.now(),
    })
    await this.save(cp)
  }

  /**
   * 标记 turn 完成。检查点保留。
   * 可选传入本轮生成的标题和描述。
   */
  async complete(
    sessionId: string, turnId: string,
    meta?: { title?: string; description?: string },
  ): Promise<void> {
    if (!meta) return
    const cp = await this.load(sessionId, turnId)
    if (!cp) return
    if (meta.title !== undefined) cp.title = meta.title
    if (meta.description !== undefined) cp.description = meta.description
    await this.save(cp)
  }

  // ── 回滚 ──

  async rollback(sessionId: string, turnId: string): Promise<number | null> {
    const cp = await this.load(sessionId, turnId)
    if (!cp) return null
    await this.restoreFiles(cp)
    return cp.messageCount
  }

  async rollbackToMessageIndex(sessionId: string, targetIndex: number, filePaths?: string[]): Promise<RollbackResult | null> {
    const all = await this.listCheckpoints(sessionId)
    const candidates = all.filter((c) => c.messageCount <= targetIndex)
    if (candidates.length === 0) return null
    const best = candidates[candidates.length - 1]

    const cp = await this.load(sessionId, best.turnId)
    if (!cp) return null

    const restored = await this.restoreFiles(cp, filePaths)

    // 清理失效检查点（仅全量回滚时清理）
    if (!filePaths) {
      const invalid = all.filter((c) => c.messageCount > best.messageCount)
      for (const c of invalid) await this.clear(sessionId, c.turnId)
    }

    return { messageCount: best.messageCount, filesRestored: restored }
  }

  private async restoreFiles(cp: Checkpoint, filePaths?: string[]): Promise<number> {
    let count = 0
    for (const entry of [...cp.files].reverse()) {
      if (filePaths && !filePaths.includes(entry.path)) continue
      try {
        if (entry.content !== null) {
          await fs.mkdir(dirname(entry.path), { recursive: true })
          await fs.writeFile(entry.path, entry.content, 'utf-8')
        } else {
          await fs.rm(entry.path, { force: true })
        }
        count++
      } catch (err) {
        console.error(`[checkpoint] 回滚文件失败: ${entry.path}`, err)
      }
    }
    return count
  }

  // ── 回滚点 ──

  async getRollbackPoints(sessionId: string): Promise<RollbackPoint[]> {
    const checkpoints = await this.listCheckpoints(sessionId)
    const maxMsg = checkpoints.length > 0
      ? Math.max(...checkpoints.map((c) => c.messageCount)) + 1 // +1 覆盖 AI 回复索引
      : 0
    const pointMap = new Map<number, RollbackPoint>()
    for (const cp of checkpoints) {
      const full = await this.load(sessionId, cp.turnId)
      const allFiles = full?.files ?? []
      const rp: RollbackPoint = {
        messageIndex: cp.messageCount,
        turnId: cp.turnId,
        fileCount: cp.fileCount,
        timestamp: cp.timestamp,
        filePaths: allFiles.map((f) => f.path) ?? undefined,
        agentFileCount: allFiles.filter((f) => f.changeSource === 'agent').length,
      }
      pointMap.set(cp.messageCount, rp)
      // 也关联到第一条 AI 回复的索引，使 diff 按钮在 AI 消息上也可用
      pointMap.set(cp.messageCount + 1, { ...rp, messageIndex: cp.messageCount + 1 })
    }
    const result: RollbackPoint[] = []
    for (let i = 0; i <= maxMsg; i++) {
      const p = pointMap.get(i)
      result.push(p ?? { messageIndex: i, turnId: '', fileCount: 0, timestamp: 0 })
    }
    return result
  }

  // ── Diff ──

  /**
   * 返回两个检查点之间所有文件的变更。
   * 如果 checkpoint 中已缓存 diff 则直接返回，否则实时计算。
   */
  async getDiff(sessionId: string, turnIdA: string, turnIdB: string): Promise<DiffEntry[]> {
    const cpA = await this.load(sessionId, turnIdA)
    const cpB = await this.load(sessionId, turnIdB)
    if (!cpA || !cpB) {
      debugLog('checkpoint', 'getDiff: cp not found', { sessionId, turnIdA, turnIdB })
      return []
    }

    debugLog('checkpoint', 'getDiff: checkpoints loaded', {
      filesA: cpA.files.length, filesB: cpB.files.length,
      isFirst: turnIdA === turnIdB,
    })

    const entries: DiffEntry[] = []

    // 收集两个检查点中涉及的所有文件路径
    const allPaths = new Set<string>()
    for (const f of cpA.files) allPaths.add(f.path)
    for (const f of cpB.files) allPaths.add(f.path)

    debugLog('checkpoint', 'getDiff: allPaths', { count: allPaths.size, paths: Array.from(allPaths) })

    const isFirst = turnIdA === turnIdB

    for (const path of allPaths) {
      const entryA = cpA.files.find((f) => f.path === path)
      const entryB = cpB.files.find((f) => f.path === path)

      // 第一个检查点：对比文件当前内容与检查点内容（修改前）的变化
      if (isFirst && entryB) {
        const currentContent = await this.readCurrentFileContent(path)
        const snapshotContent = entryB.content ?? ''
        debugLog('checkpoint', 'getDiff: first checkpoint file', {
          path,
          snapshotLen: snapshotContent.length,
          currentLen: currentContent.length,
          changed: currentContent !== snapshotContent,
        })
        if (currentContent !== snapshotContent) {
          entries.push({
            path,
            diff: this.computeDiff(snapshotContent, currentContent),
            changeSource: entryB.changeSource,
            timestampA: entryB.timestamp,
            timestampB: Date.now(),
          })
        }
        continue
      }

      // 优先使用已缓存的 diff
      if (entryB?.diff) {
        entries.push({
          path,
          diff: entryB.diff,
          changeSource: entryB.changeSource,
          timestampA: entryA?.timestamp ?? cpA.timestamp,
          timestampB: entryB.timestamp,
        })
        continue
      }

      // 实时计算
      const contentA = entryA?.content ?? ''
      const contentB = entryB?.content ?? ''
      if (contentA !== contentB) {
        entries.push({
          path,
          diff: this.computeDiff(contentA, contentB),
          changeSource: entryB?.changeSource ?? 'unknown',
          timestampA: entryA?.timestamp ?? cpA.timestamp,
          timestampB: entryB?.timestamp ?? cpB.timestamp,
        })
      }
    }

    debugLog('checkpoint', 'getDiff: result', { entryCount: entries.length })
    return entries
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

  async clear(sessionId: string, turnId: string): Promise<void> {
    try { await fs.rm(this.checkpointPath(sessionId, turnId), { force: true }) } catch { }
  }

  /** 清理 session 的所有检查点（删除 session 时调用）。 */
  async clearAll(sessionId: string): Promise<void> {
    const all = await this.listCheckpoints(sessionId)
    for (const c of all) await this.clear(sessionId, c.turnId)
  }

  async prune(sessionId: string, keepCount: number): Promise<void> {
    const all = await this.listCheckpoints(sessionId)
    const toDelete = all.slice(0, Math.max(0, all.length - keepCount))
    for (const c of toDelete) await this.clear(sessionId, c.turnId)
  }

  // ── 查询 ──

  async load(sessionId: string, turnId: string): Promise<Checkpoint | null> {
    try {
      return JSON.parse(await fs.readFile(this.checkpointPath(sessionId, turnId), 'utf-8')) as Checkpoint
    } catch { return null }
  }

  async listCheckpoints(sessionId: string): Promise<{ turnId: string; messageCount: number; timestamp: number; fileCount: number; title?: string }[]> {
    const results: { turnId: string; messageCount: number; timestamp: number; fileCount: number; title?: string }[] = []
    try {
      const files = await fs.readdir(this.checkpointsDir)
      for (const file of files) {
        if (!file.startsWith(`${sessionId}_`) || !file.endsWith('.json')) continue
        const turnId = file.slice(sessionId.length + 1, -5)
        const cp = await this.load(sessionId, turnId)
        if (cp) results.push({
          turnId: cp.turnId, messageCount: cp.messageCount,
          timestamp: cp.timestamp, fileCount: cp.files.length,
          title: cp.title,
        })
      }
    } catch { }
    results.sort((a, b) => a.timestamp - b.timestamp)
    return results
  }
}
