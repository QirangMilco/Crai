/** 从消息的 parts 数组中提取纯文本。 */
export function extractTextFromParts(parts: any[] | undefined): string {
  if (!parts) return ''
  return parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
}
