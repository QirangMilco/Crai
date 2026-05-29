/**
 * @crai/config — 配置系统类型定义
 *
 * 应用级配置类型，不属于跨包共享契约（@crai/core）。
 * 包括变体配置、应用身份、调试范围等。
 */
export interface AppVariant {
  configDirName: string
  workspaceDataDirName: string
  server: {
    defaultPort: number
    /** 是否禁用访问鉴权（仅本地开发时使用）。默认 false。 */
    disableAuth?: boolean
  }
  debug: {
    trace: boolean
    /** 日志级别：debug | info | warn | error */
    logLevel?: string
    /** 日志文件输出目录。设置后日志以追加模式写入文件。 */
    logDir?: string
    /** 单个日志文件最大字节数（默认 10MB）。 */
    maxFileSize?: number
    /** 保留的旧日志文件数量（默认 3）。 */
    maxBackups?: number
    /** 调试输出范围。兼容两种格式：
     *   - string[]: 仅服务端 scope（旧格式）
     *   - { server?, client? }: 前后端分开配置
     */
    scopes?: string[] | { server?: string[]; client?: string[] }
  }
}
