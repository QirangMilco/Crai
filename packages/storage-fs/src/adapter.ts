/**
 * FileStorageAdapter。
 * 将 session、message、artifact 持久化到本地文件系统。
 * - session：每个 session 一个 JSON 文件
 * - messages：每个 session 一个 JSONL 文件（每行一条消息，追加语义）
 * - artifacts：每个 artifact 一个 JSON 文件
 * 通过 Extension 工厂注册到 runtime，支持热替换。
 */
import type { Artifact, ID, Message, Session, StorageAdapter, Timestamp } from '@crai/core'
import { mkdir, readFile, writeFile, appendFile, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { ADAPTER_NAME, DIRS, FILE_SUFFIX_JSON, FILE_SUFFIX_JSONL } from './constants'

export interface FileStorageOptions {
  baseDir?: string
  adapterName?: string
}

function sessionPath(baseDir: string, sessionId: ID): string {
  return join(baseDir, DIRS.SESSIONS, `${sessionId}${FILE_SUFFIX_JSON}`)
}

function messagesPath(baseDir: string, sessionId: ID): string {
  return join(baseDir, DIRS.MESSAGES, `${sessionId}${FILE_SUFFIX_JSONL}`)
}

function artifactPath(baseDir: string, artifactId: ID): string {
  return join(baseDir, DIRS.ARTIFACTS, `${artifactId}${FILE_SUFFIX_JSON}`)
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(filePath.slice(0, filePath.lastIndexOf('/')))
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/** 逐行读取 JSONL 文件，返回解析后的对象数组。 */
async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const results: T[] = []
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    })
    for await (const line of rl) {
      const trimmed = line.trim()
      if (trimmed) {
        results.push(JSON.parse(trimmed) as T)
      }
    }
    return results
  } catch {
    return []
  }
}

export class FileStorageAdapter implements StorageAdapter {
  readonly name: string

  constructor(private readonly options: FileStorageOptions) {
    this.name = options.adapterName ?? ADAPTER_NAME
  }

  private get baseDir(): string {
    return this.options.baseDir ?? '.crai/data'
  }

  async createSession(session: Session): Promise<void> {
    await writeJson(sessionPath(this.baseDir, session.id), session)
  }

  async updateSession(session: Session): Promise<void> {
    await writeJson(sessionPath(this.baseDir, session.id), session)
  }

  /** 以 JSONL 格式追加写入一条消息。仅追加到文件末尾，不读取已有内容。 */
  async appendMessage(sessionId: ID, message: Message): Promise<void> {
    const filePath = messagesPath(this.baseDir, sessionId)
    await ensureDir(filePath.slice(0, filePath.lastIndexOf('/')))
    await appendFile(filePath, JSON.stringify(message) + '\n', 'utf-8')
  }

  async listMessages(sessionId: ID): Promise<Message[]> {
    return readJsonl<Message>(messagesPath(this.baseDir, sessionId))
  }

  async listSessions(): Promise<Array<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp }>> {
    const dir = join(this.baseDir, DIRS.SESSIONS)
    try {
      const files = await readdir(dir)
      const sessions: Array<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp }> = []
      for (const file of files) {
        if (!file.endsWith(FILE_SUFFIX_JSON)) continue
        const s = await readJson<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp }>(join(dir, file))
        if (s) sessions.push(s)
      }
      return sessions
    } catch {
      return []
    }
  }

  async deleteSession(sessionId: ID): Promise<void> {
    const sp = sessionPath(this.baseDir, sessionId)
    const mp = messagesPath(this.baseDir, sessionId)
    try { await rm(sp) } catch { /* 文件不存在 */ }
    try { await rm(mp) } catch { /* 文件不存在 */ }
  }

  async saveArtifact(artifact: Artifact): Promise<void> {
    await writeJson(artifactPath(this.baseDir, artifact.id), artifact)
  }
}
