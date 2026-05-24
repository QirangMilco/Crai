import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTodoWriteTool } from '../src/todoTool'

describe('todo-write tool', () => {
  it('creates a tool with the correct name and safety level', () => {
    const tool = createTodoWriteTool()
    assert.equal(tool.definition.name, 'todo-write')
    assert.equal(tool.definition.safetyLevel, 'safe')
  })

  it('creates todos from a flat list', async () => {
    const tool = createTodoWriteTool()
    const session = {
      id: 'test-session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const result = await tool.execute({
      session: session as any,
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tc-1',
        name: 'todo-write',
        arguments: {
          todos: [
            { content: '第一步', status: 'in_progress' },
            { content: '第二步', status: 'pending' },
          ],
        },
      },
      messages: [],
    })

    assert.equal(result.toolCallId, 'tc-1')
    assert.equal(result.name, 'todo-write')
    assert.ok(result.content?.length)
    const text = (result.content![0] as any).text
    assert.match(text, /TODO/)
    assert.match(text, /2 项/)
    assert.match(text, /1 进行中/)
    assert.match(text, /1 待办/)
  })

  it('stores todos on the session object', async () => {
    const tool = createTodoWriteTool()
    const session: any = {
      id: 'test-session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await tool.execute({
      session,
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tc-2',
        name: 'todo-write',
        arguments: {
          todos: [
            { content: '分析需求', status: 'completed' },
            { content: '实现代码', status: 'in_progress' },
          ],
        },
      },
      messages: [],
    })

    assert.ok(Array.isArray(session.todos))
    assert.equal(session.todos.length, 2)
    assert.equal(session.todos[0].status, 'completed')
    assert.equal(session.todos[1].status, 'in_progress')
  })

  it('warns when multiple todos are in_progress', async () => {
    const tool = createTodoWriteTool()
    const result = await tool.execute({
      session: {} as any,
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tc-3',
        name: 'todo-write',
        arguments: {
          todos: [
            { content: '任务一', status: 'in_progress' },
            { content: '任务二', status: 'in_progress' },
            { content: '任务三', status: 'pending' },
          ],
        },
      },
      messages: [],
    })

    const text = (result.content![0] as any).text
    assert.match(text, /警告/)
  })

  it('handles empty todos list', async () => {
    const tool = createTodoWriteTool()
    const result = await tool.execute({
      session: {} as any,
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tc-4',
        name: 'todo-write',
        arguments: { todos: [] },
      },
      messages: [],
    })

    const text = (result.content![0] as any).text
    assert.match(text, /0 项/)
    assert.doesNotMatch(text, /警告/)
  })

  it('handles missing todos argument gracefully', async () => {
    const tool = createTodoWriteTool()
    const result = await tool.execute({
      session: {} as any,
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tc-5',
        name: 'todo-write',
        arguments: {},
      },
      messages: [],
    })

    const text = (result.content![0] as any).text
    assert.match(text, /0 项/)
  })
})
