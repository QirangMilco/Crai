declare module 'diff' {
  export function diffLines(
    oldStr: string,
    newStr: string,
    options?: { ignoreWhitespace?: boolean }
  ): Array<{ value: string; added?: boolean; removed?: boolean; count?: number }>
}
