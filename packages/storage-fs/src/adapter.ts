/**
 * FileStorageAdapter。
 * 将 session、message、artifact 持久化到本地文件系统。
 * 通过 Extension 工厂注册到 runtime，支持热替换。
 */
import type { Artifact, ID, Message, Session, StorageAdapter } from '../../../core/src'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ADAPTER_NAME, DIRS, FILE_SUFFIX } from './constants'

export interface FileStorageOptions {
  baseDir?: string
  adapterName?: string
}

function sessionPath(baseDir: string, sessionId: ID): string {
  return join(baseDir, DIRS.SESSIONS, `${sessionId}${FILE_SUFFIX}`)
}

function messagesPath(baseDir: string, sessionId: ID): string {
  return join(baseDir, DIRS.MESSAGES, `${sessionId}${FILE_SUFFIX}`)
}

function artifactPath(baseDir: string, artifactId: ID): string {
  return join(baseDir, DIRS.ARTIFACTS, `${artifactId}${FILE_SUFFIX}`)
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

  async appendMessage(sessionId: ID, message: Message): Promise<void> {
    const filePath = messagesPath(this.baseDir, sessionId)
    const existing = await readJson<Message[]>(filePath) ?? []
    existing.push(message)
    await writeJson(filePath, existing)
  }

  async listMessages(sessionId: ID): Promise<Message[]> {
    return await readJson<Message[]>(messagesPath(this.baseDir, sessionId)) ?? []
  }

  async saveArtifact(artifact: Artifact): Promise<void> {
    await writeJson(artifactPath(this.baseDir, artifact.id), artifact)
  }
}
