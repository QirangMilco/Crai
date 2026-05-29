/**
 * 服务端访问鉴权。
 *
 * 在首次启动时自动生成一个随机 token，以 scrypt 哈希存储在
 * <configDir>/server-auth.json 中。原始 token 打印在控制台，
 * 供客户端连接时使用（ws://host:port?token=xxx）。
 *
 * 参考：OpenHanako device-registry.js 的配对和密钥生成机制。
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ServerAuthResult {
  /** 用于在控制台显示的原始 token。仅首次生成时可见。 */
  rawToken: string
  /** 验证函数：给定 token 字符串，返回是否匹配。 */
  verify: (token: string) => boolean
}

export function ensureServerAuth(configDir: string, logger?: { info: (msg: string) => void }): ServerAuthResult {
  const filePath = join(configDir, 'server-auth.json')
  let rawToken: string

  if (existsSync(filePath)) {
    // 已存在，只读取哈希和盐，不暴露原始 token
    const stored = JSON.parse(readFileSync(filePath, 'utf-8'))
    return {
      rawToken: '',
      verify: (token: string) => verifyStoredToken(token, stored.hash, stored.salt),
    }
  }

  // 首次运行：生成新 token
  rawToken = `crai_${randomBytes(32).toString('base64url')}`
  const salt = randomBytes(16).toString('base64url')
  const hash = hashToken(rawToken, salt)

  mkdirSync(configDir, { recursive: true })
  writeFileSync(filePath, JSON.stringify({ hash, salt }, null, 2) + '\n')

  logger?.info(`服务器访问密钥已生成`)
  logger?.info(`┌──────────────────────────────────────────────────`)
  logger?.info(`│ 密钥: ${rawToken}`)
  logger?.info(`│ (本消息仅在首次启动时显示，请妥善保管)`)
  logger?.info(`└──────────────────────────────────────────────────`)

  return {
    rawToken,
    verify: (token: string) => verifyStoredToken(token, hash, salt),
  }
}

function hashToken(token: string, salt: string): string {
  return scryptSync(token, salt, 32).toString('base64url')
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
