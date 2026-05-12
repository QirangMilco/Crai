import { promises as fs } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'

// ── 类型 ─────────────────────────────────────────────

/** 单文件备份条目。 */
export interface FileSnapshotEntry {
  /** 文件在 workspace 中的相对路径。 */
  relativePath: string
  /** 原始内容的 SHA256 hash。 */
  contentHash: string
  /** 原始内容（文件不存在时为 null）。 */
  content: string | null
  /** 备份前文件是否已存在。 */
  existed: boolean
}

/** 单次编辑操作的快照。 */
export interface Snapshot {
  sessionId: string
  /** 触发此次备份的操作在 session 中的序号（从 1 开始）。 */
  operationIndex: number
  timestamp: number
  backupDir: string
  files: FileSnapshotEntry[]
}

/** 快照元数据（不含文件内容，用于列表展示）。 */
export interface SnapshotMeta {
  sessionId: string
  operationIndex: number
  timestamp: number
  files: { relativePath: string; contentHash: string; existed: boolean }[]
}

// ── 快照管理器 ──────────────────────────────────────

export class SnapshotManager {
  private snapshotsDir: string
  private operationCounter = 0

  constructor(snapshotsDir: string) {
    this.snapshotsDir = snapshotsDir
  }

  /** 获取当前操作序号并自增。 */
  private nextOperationIndex(): number {
    return ++this.operationCounter
  }

  /** 在工作区相对路径。 */
  private relativePath(absolutePath: string, rootDir: string): string {
    const rel = absolutePath.startsWith(rootDir) ? absolutePath.slice(rootDir.length) : absolutePath
    return rel.replace(/^[/\\]+/, '') || '.'
  }

  /** 计算内容的 SHA256 hash。 */
  private contentHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16)
  }

  /** 快照文件路径。 */
  private snapshotPath(sessionId: string, operationIndex: number): string {
    return resolve(this.snapshotsDir, `${sessionId}_${operationIndex}.json`)
  }

  /**
   * 创建一次快照。记录文件修改前的内容。
   * @param sessionId 当前 session
   * @param rootDir 工作区根目录（用于计算相对路径）
   * @param files 要备份的文件绝对路径列表
   */
  /**
   * 创建一次快照。返回操作序号。
   */
  async snapshot(
    sessionId: string,
    rootDir: string,
    files: string[],
  ): Promise<number> {
    const operationIndex = this.nextOperationIndex()
    const entries: FileSnapshotEntry[] = []

    for (const filePath of files) {
      let content: string | null = null
      let existed = true

      try {
        content = await fs.readFile(filePath, 'utf-8')
      } catch {
        existed = false
      }

      entries.push({
        relativePath: this.relativePath(filePath, rootDir),
        contentHash: content ? this.contentHash(content) : '',
        content,
        existed,
      })
    }

    const snapshot: Snapshot = {
      sessionId,
      operationIndex,
      timestamp: Date.now(),
      backupDir: this.snapshotsDir,
      files: entries,
    }

    await fs.mkdir(this.snapshotsDir, { recursive: true })
    await fs.writeFile(
      this.snapshotPath(sessionId, operationIndex),
      JSON.stringify(snapshot, null, 2),
      'utf-8',
    )

    return operationIndex
  }

  /** 加载指定快照。 */
  async loadSnapshot(sessionId: string, operationIndex: number): Promise<Snapshot | null> {
    try {
      const raw = await fs.readFile(this.snapshotPath(sessionId, operationIndex), 'utf-8')
      return JSON.parse(raw) as Snapshot
    } catch {
      return null
    }
  }

  /** 列出某个 session 的全部快照元数据（不含文件内容）。 */
  async listSnapshots(sessionId: string): Promise<SnapshotMeta[]> {
    const metas: SnapshotMeta[] = []
    try {
      const files = await fs.readdir(this.snapshotsDir)
      for (const file of files) {
        if (!file.startsWith(`${sessionId}_`) || !file.endsWith('.json')) continue
        try {
          const raw = await fs.readFile(resolve(this.snapshotsDir, file), 'utf-8')
          const snap = JSON.parse(raw) as Snapshot
          metas.push({
            sessionId: snap.sessionId,
            operationIndex: snap.operationIndex,
            timestamp: snap.timestamp,
            files: snap.files.map(f => ({
              relativePath: f.relativePath,
              contentHash: f.contentHash,
              existed: f.existed,
            })),
          })
        } catch { /* 跳过损坏文件 */ }
      }
    } catch { /* 目录不存在 */ }
    metas.sort((a, b) => a.operationIndex - b.operationIndex)
    return metas
  }

  /**
   * 回滚到指定快照。恢复该快照中所有文件的内容。
   * @returns 恢复的文件列表
   */
  async rollback(sessionId: string, operationIndex: number, rootDir: string): Promise<string[]> {
    const snap = await this.loadSnapshot(sessionId, operationIndex)
    if (!snap) throw new Error(`快照未找到: ${sessionId}_${operationIndex}`)

    const restored: string[] = []
    for (const entry of snap.files) {
      const absolutePath = resolve(rootDir, entry.relativePath)
      if (entry.existed && entry.content !== null) {
        await fs.mkdir(dirname(absolutePath), { recursive: true })
        await fs.writeFile(absolutePath, entry.content, 'utf-8')
        restored.push(absolutePath)
      } else if (!entry.existed) {
        // 文件在备份前不存在 → 删除
        await fs.rm(absolutePath, { force: true })
        restored.push(absolutePath + ' (deleted)')
      }
    }
    return restored
  }

  /** 清理指定 session 的所有快照。 */
  async clearSnapshots(sessionId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.snapshotsDir)
      for (const file of files) {
        if (file.startsWith(`${sessionId}_`) && file.endsWith('.json')) {
          await fs.rm(resolve(this.snapshotsDir, file), { force: true })
        }
      }
    } catch { /* 目录不存在 */ }
  }
}
