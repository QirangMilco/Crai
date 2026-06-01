/**
 * 服务端访问鉴权。
 *
 * 支持多个访问密钥，以 scrypt 哈希存储在 <configDir>/server-auth.json 中。
 * 首次启动自动生成初始密钥，即使没有禁用 auth 也在设置页提供管理界面。
 *
 * 参考：OpenHanako device-registry.js
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AuthKeyInfo {
  id: string
  description: string
  createdAt: string
  lastUsedAt: string | null
  status: 'active' | 'revoked'
}

export interface ServerAuthResult {
  /** 验证函数：给定 token 字符串，返回匹配的密钥 ID 或 null。匹配时自动更新 lastUsedAt。 */
  verify: (token: string) => string | null
  /** 列出所有密钥（不含 hash/salt）。 */
  listKeys: () => AuthKeyInfo[]
  /** 创建新密钥。返回原始 token（仅此一次可见）和密钥信息。 */
  generateKey: (description: string) => { rawToken: string; info: AuthKeyInfo }
  /** 吊销一个密钥。返回吊销的密钥 ID。 */
  revokeKey: (id: string) => void
}

interface StoredAuthKey {
  id: string
  description: string
  secretHash: string
  secretSalt: string
  createdAt: string
  lastUsedAt: string | null
  status: 'active' | 'revoked'
}

interface StoredData {
  schemaVersion: number
  keys: StoredAuthKey[]
}

const SCHEMA_VERSION = 1
const KEY_PREFIX = 'crai_'

function createEmptyData(): StoredData {
  return { schemaVersion: SCHEMA_VERSION, keys: [] }
}

function loadData(filePath: string): StoredData {
  try {
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
      // 迁移：旧格式 { hash, salt } → 新格式 { schemaVersion, keys }
      if (raw && raw.hash && raw.salt && !raw.keys) {
        return {
          schemaVersion: SCHEMA_VERSION,
          keys: [{
            id: makeId(),
            description: '初始密钥（自动迁移）',
            secretHash: raw.hash,
            secretSalt: raw.salt,
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            status: 'active',
          }],
        }
      }
      return raw as StoredData
    }
  } catch { /* 忽略解析错误，回退到空数据 */ }
  return createEmptyData()
}

function saveData(filePath: string, data: StoredData): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function hashToken(token: string, salt: string): string {
  return scryptSync(token, salt, 32).toString('base64url')
}

function generateToken(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`
}

function makeId(): string {
  return `key_${Date.now()}_${randomBytes(4).toString('hex')}`
}

export function createServerAuth(configDir: string, logger?: { info: (msg: string) => void }): ServerAuthResult {
  const filePath = join(configDir, 'server-auth.json')
  mkdirSync(configDir, { recursive: true })

  // 首次运行：确保至少有一个活跃密钥
  let data = loadData(filePath)
  const hasActiveKeys = data.keys.some((k) => k.status === 'active')

  if (!hasActiveKeys) {
    const rawToken = generateToken()
    const salt = randomBytes(16).toString('base64url')
    const hash = hashToken(rawToken, salt)
    const now = new Date().toISOString()

    data.keys.push({
      id: makeId(),
      description: '初始密钥',
      secretHash: hash,
      secretSalt: salt,
      createdAt: now,
      lastUsedAt: null,
      status: 'active',
    })
    saveData(filePath, data)

    logger?.info(`服务器访问密钥已生成`)
    logger?.info(`┌──────────────────────────────────────────────────`)
    logger?.info(`│ 密钥: ${rawToken}`)
    logger?.info(`│ (请复制到安全位置，本消息仅首次启动时显示)`)
    logger?.info(`└──────────────────────────────────────────────────`)
  }

  function verify(token: string): string | null {
    if (!token) return null
    // 重新加载确保最新数据
    data = loadData(filePath)
    for (const key of data.keys) {
      if (key.status !== 'active') continue
      if (token.startsWith(KEY_PREFIX) && verifyStoredToken(token, key.secretHash, key.secretSalt)) {
        // 匹配成功后更新 lastUsedAt
        key.lastUsedAt = new Date().toISOString()
        saveData(filePath, data)
        return key.id
      }
    }
    return null
  }

  function listKeys(): AuthKeyInfo[] {
    // 重新加载确保返回最新数据
    data = loadData(filePath)
    return data.keys.map((k) => ({
      id: k.id,
      description: k.description,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      status: k.status,
    }))
  }

  function generateKey(description: string): { rawToken: string; info: AuthKeyInfo } {
    data = loadData(filePath)
    const rawToken = generateToken()
    const salt = randomBytes(16).toString('base64url')
    const hash = hashToken(rawToken, salt)
    const now = new Date().toISOString()
    const id = makeId()

    data.keys.push({
      id,
      description: description || '未命名密钥',
      secretHash: hash,
      secretSalt: salt,
      createdAt: now,
      lastUsedAt: null,
      status: 'active',
    })
    saveData(filePath, data)

    return {
      rawToken,
      info: { id, description: description || '未命名密钥', createdAt: now, lastUsedAt: null, status: 'active' },
    }
  }

  function revokeKey(id: string): void {
    data = loadData(filePath)
    const key = data.keys.find((k) => k.id === id)
    if (!key) throw new Error(`密钥 ${id} 不存在`)
    key.status = 'revoked'
    saveData(filePath, data)
  }

  return { verify, listKeys, generateKey, revokeKey }
}

function verifyStoredToken(token: string, storedHash: string, salt: string): boolean {
  if (!token || !storedHash || !salt) return false
  try {
    const actual = Buffer.from(hashToken(token, salt))
    const expected = Buffer.from(storedHash)
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
