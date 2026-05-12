/**
 * @crai/config — 配置加密工具
 *
 * 使用随机生成的密钥文件 + AES-256-GCM 加密 API keys。
 * 密钥存储在配置目录下（如 `~/.crai-dev/.crai-key-enc`）。
 * 如果密钥文件丢失，已加密的 API key 无法恢复，需重新配置。
 *
 * encrypt/decrypt 接收可选的 keyDir 参数。不传时使用 `~/.crai-dev/`（开发环境默认）。
 * 生产环境和自定义变体应传入自己的目录。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_FILE = '.crai-key-enc'
const ENCRYPTED_PREFIX = '$aes$'

function getOrCreateKey(keyDir: string): Buffer {
  mkdirSync(keyDir, { recursive: true })
  const keyPath = join(keyDir, KEY_FILE)
  if (existsSync(keyPath)) {
    return Buffer.from(readFileSync(keyPath, 'utf-8').trim(), 'hex')
  }
  const key = randomBytes(KEY_LENGTH)
  writeFileSync(keyPath, key.toString('hex'), { mode: 0o600, encoding: 'utf-8' })
  return key
}

/** 全局配置目录，作为默认 keyDir。 */
function defaultKeyDir(): string {
  // 开发环境默认 ~/.crai-dev
  return join(homedir(), '.crai-dev')
}

/**
 * 加密明文。返回 `$aes$<base64>` 格式的字符串。
 * @param plaintext 明文
 * @param keyDir 密钥文件所在目录（不传时使用默认配置目录）
 */
export function encrypt(plaintext: string, keyDir?: string): string {
  const dir = keyDir ?? defaultKeyDir()
  const key = getOrCreateKey(dir)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, encrypted])
  return ENCRYPTED_PREFIX + payload.toString('base64')
}

/**
 * 解密密文。支持两种格式：
 * - `$aes$<base64>` — 加密格式
 * - 其他 — 视为明文原样返回（向后兼容）
 * @param keyDir 密钥文件所在目录（不传时使用默认配置目录）
 */
export function decrypt(ciphertext: string, keyDir?: string): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext
  }
  const dir = keyDir ?? defaultKeyDir()
  const key = getOrCreateKey(dir)
  const raw = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf-8')
}
