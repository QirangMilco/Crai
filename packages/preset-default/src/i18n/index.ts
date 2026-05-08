import type { I18nAdapter } from '@crai/core'
import { en } from './en'
import { zhCN } from './zh-CN'

const BUNDLED: Record<string, Record<string, string>> = {
  en,
  'zh-CN': zhCN,
}

const DEFAULT_LANG = 'en'

function detectLanguage(fallback: string = DEFAULT_LANG): string {
  const supported = Object.keys(BUNDLED)
  try {
    const preferred = Intl.DateTimeFormat().resolvedOptions().locale
    if (supported.includes(preferred)) return preferred
    const lang = preferred.split('-')[0]
    const match = supported.find((s) => s.startsWith(lang))
    if (match) return match
  } catch {
    // Intl not available, use fallback
  }
  return fallback
}

export function createDefaultI18nAdapter(initialLang?: string): I18nAdapter {
  let currentLang = initialLang ?? detectLanguage()
  let messages = BUNDLED[currentLang] ?? BUNDLED[DEFAULT_LANG]

  return {
    name: 'preset-default:i18n',
    t(key, params) {
      let msg = messages[key]
      if (msg === undefined) {
        const fallback = BUNDLED[DEFAULT_LANG][key]
        msg = fallback ?? key
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(`{${k}}`, String(v))
        }
      }
      return msg
    },
    setLanguage(lang) {
      if (BUNDLED[lang]) {
        currentLang = lang
        messages = BUNDLED[lang]
      }
    },
    getLanguage() {
      return currentLang
    },
  }
}
