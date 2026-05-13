/**
 * @crai/base — 路径工具函数与日志实现测试。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveAllowedPath, getPathArg, validateToolPaths } from '../src/path'
import { ConsoleLogger } from '../src/logger'

describe('resolveAllowedPath', () => {
  it('合法路径返回标准化绝对路径', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = resolveAllowedPath('src/file.ts', root)
    assert.equal(result, join(root, 'src/file.ts'))
    rmSync(root, { recursive: true, force: true })
  })

  it('子目录路径合法', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = resolveAllowedPath('a/b/c/d.ts', root)
    assert.equal(result, join(root, 'a/b/c/d.ts'))
    rmSync(root, { recursive: true, force: true })
  })

  it('根目录本身返回根目录', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = resolveAllowedPath('.', root)
    assert.equal(result, root)
    rmSync(root, { recursive: true, force: true })
  })

  it('.. 逃逸抛出错误', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    assert.throws(() => resolveAllowedPath('../etc', root), /路径拒绝/)
    rmSync(root, { recursive: true, force: true })
  })

  it('多层 .. 逃逸抛出错误', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    assert.throws(() => resolveAllowedPath('a/../../etc', root), /路径拒绝/)
    rmSync(root, { recursive: true, force: true })
  })

  it('绝对路径逃逸抛出错误', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    assert.throws(() => resolveAllowedPath('/etc', root), /路径拒绝/)
    rmSync(root, { recursive: true, force: true })
  })

  it('空字符串解析为 rootDir 本身', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = resolveAllowedPath('', root)
    assert.equal(result, root)
    rmSync(root, { recursive: true, force: true })
  })
})

describe('getPathArg', () => {
  it('标准 path 参数提取并校验', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = getPathArg({ path: 'test.txt' }, root)
    assert.equal(result, join(root, 'test.txt'))
    rmSync(root, { recursive: true, force: true })
  })

  it('path 参数为空字符串时抛出错误', () => {
    assert.throws(() => getPathArg({ path: '' }, '/tmp'), /path 参数必须是非空字符串/)
  })

  it('path 参数不存在时抛出错误', () => {
    assert.throws(() => getPathArg({}, '/tmp'), /path 参数必须是非空字符串/)
  })

  it('path 参数逃逸时抛出错误', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    assert.throws(() => getPathArg({ path: '../secret' }, root), /路径拒绝/)
    rmSync(root, { recursive: true, force: true })
  })
})

describe('validateToolPaths', () => {
  it('所有路径合法时返回 undefined', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = validateToolPaths({ path: 'a.txt', dir: 'sub' }, root)
    assert.equal(result, undefined)
    rmSync(root, { recursive: true, force: true })
  })

  it('首个非法路径返回错误信息', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = validateToolPaths({ path: '../bad', source: 'ok' }, root)
    assert.ok(result)
    assert.equal(result?.argName, 'path')
    rmSync(root, { recursive: true, force: true })
  })

  it('非路径参数忽略', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = validateToolPaths({ content: 'hello', text: 'world' }, root)
    assert.equal(result, undefined)
    rmSync(root, { recursive: true, force: true })
  })

  it('非字符串值忽略', () => {
    const root = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const result = validateToolPaths({ path: 123, dir: true } as any, root)
    assert.equal(result, undefined)
    rmSync(root, { recursive: true, force: true })
  })
})

describe('ConsoleLogger', () => {
  it('info 级别输出到控制台', () => {
    const logger = new ConsoleLogger({ level: 'info' })
    logger.info('test message')
    logger.debug('should not appear')
  })

  it('warn 和 error 级别输出', () => {
    const logger = new ConsoleLogger({ level: 'warn' })
    logger.warn('warning message')
    logger.error('error message')
    logger.info('should not appear')
  })

  it('文件输出模式写入日志文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-log-test-'))
    const logger = new ConsoleLogger({
      level: 'info',
      outputFile: join(dir, 'test.log'),
    })

    logger.info('hello from test')
    logger.warn('warning')

    const content = readFileSync(join(dir, 'test.log'), 'utf-8')
    assert.ok(content.includes('hello from test'))
    assert.ok(content.includes('warning'))

    rmSync(dir, { recursive: true, force: true })
  })

  it('debug 级别文件名包含 debug', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-log-test-'))
    const logger = new ConsoleLogger({
      level: 'debug',
      outputFile: join(dir, 'app.log'),
      maxFileSize: 1000000,
      maxBackups: 2,
    })

    logger.debug('debug test')
    const content = readFileSync(join(dir, 'app.log'), 'utf-8')
    assert.ok(content.includes('debug test'))

    rmSync(dir, { recursive: true, force: true })
  })

  it('文件轮转：超出 maxFileSize 时创建备份', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-log-test-'))
    const logFile = join(dir, 'rotate.log')
    const logger = new ConsoleLogger({
      level: 'info',
      outputFile: logFile,
      maxFileSize: 50, // 很小的上限，触发轮转
      maxBackups: 2,
    })

    // 写入足够多的内容触发轮转
    for (let i = 0; i < 100; i++) {
      logger.info(`line ${i} - this is a reasonably long log message for rotation testing`)
    }

    // 验证存在备份文件
    const files = [join(dir, 'rotate.log'), join(dir, 'rotate.1.log')]
    const existing = files.filter((f) => existsSync(f))
    assert.ok(existing.length >= 1, '应有至少一个日志文件')

    rmSync(dir, { recursive: true, force: true })
  })
})
