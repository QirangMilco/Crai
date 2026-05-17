/**
 * @crai/base — PII / 凭证检测与脱敏
 *
 * 在持久化写入前检测并脱敏敏感信息。
 * 参考 OpenHanako 的 pii-guard.js 实现。
 */

// ── 硬脱敏模式（检测到直接替换为 [REDACTED]） ──────────

interface PIIScanner {
  name: string
  regex: RegExp
  /** 替换模板（可选）。默认 `[REDACTED]`。 */
  replacement?: string
}

const HARD_SCANNERS: PIIScanner[] = [
  // API keys（常见前缀）
  { name: 'api_key', regex: /\b(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|gsk_[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]{20,}|xox[baprs]-[a-zA-Z0-9-]+)\b/g },
  // 内联 secret、token、password
  { name: 'inline_secret', regex: /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["']?([a-zA-Z0-9_/+=.-]{16,})["']?/gi },
  // PEM 私钥
  { name: 'private_key', regex: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  // 通用私钥/证书 base64（SSH 私钥等）
  { name: 'ssh_key', regex: /\b(ssh-[a-zA-Z0-9+/=]{100,})\b/g },
  // 信用卡号（4 组 4 位数字）
  { name: 'credit_card', regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/g },
  // 中国身份证号（18 位）
  { name: 'id_card', regex: /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g },
  // 美国社会安全号
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  // 手机号（中国大陆 11 位）
  { name: 'phone_cn', regex: /\b1[3-9]\d{9}\b/g },
]

const REDACTED = '[REDACTED]'

/**
 * 扫描文本中的敏感信息并进行脱敏替换。
 * 返回脱敏后的文本和命中日志。
 */
export function sanitizeText(
  text: string,
  options?: { replacement?: string },
): { text: string; hits: string[] } {
  let result = text
  const hits: string[] = []
  const replacement = options?.replacement ?? REDACTED

  for (const scanner of HARD_SCANNERS) {
    // 先用 regex 检测是否有匹配
    if (scanner.regex.test(result)) {
      // 重置 lastIndex（刚被 test 修改过）
      scanner.regex.lastIndex = 0
      result = result.replace(scanner.regex, scanner.replacement ?? replacement)
      hits.push(scanner.name)
    }
  }

  return { text: result, hits }
}

/**
 * 对消息 parts 数组中的文本进行 PII 脱敏。
 * 仅处理 text 和 thinking 类型的 parts，其他类型透传。
 *
 * @returns 新的 parts 数组（不可变），以及脱敏日志。
 */
export function sanitizeParts(
  parts: Array<{ type: string; [key: string]: unknown }>,
  options?: { replacement?: string },
): { parts: Array<{ type: string; [key: string]: unknown }>; hits: string[] } {
  const allHits: string[] = []
  const newParts = parts.map((part) => {
    if (part.type === 'text' && typeof part.text === 'string') {
      const { text, hits } = sanitizeText(part.text, options)
      allHits.push(...hits)
      if (hits.length > 0) {
        return { ...part, text }
      }
    }
    if (part.type === 'thinking' && typeof part.thinking === 'string') {
      const { text, hits } = sanitizeText(part.thinking, options)
      allHits.push(...hits)
      if (hits.length > 0) {
        return { ...part, thinking: text }
      }
    }
    return part
  })

  return { parts: newParts, hits: allHits }
}
