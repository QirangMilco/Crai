/**
 * devtools 基础类型。
 */

/** 任务状态。 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

/** 单条任务项。 */
export interface TaskItem {
  content: string
  activeForm?: string
  status: TaskStatus
}

/** 整个任务列表。 */
export interface TaskList {
  title?: string
  tasks: TaskItem[]
}
