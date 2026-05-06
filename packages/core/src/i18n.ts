export interface I18nAdapter {
  name: string
  t(key: string, params?: Record<string, string | number>): string
  setLanguage(lang: string): void
  getLanguage(): string
}
