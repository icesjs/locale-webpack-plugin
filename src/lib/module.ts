import fs from 'fs'
import path from 'path'
import { escapeRegExpCharacters, getSelfContext } from './utils'

/**
 * 创建资源模块的类型声明文件。
 * @param modules 可用于处理资源模块的Lib模块名。
 * @param fileTypes 支持的资源类型后缀名称。
 * @param targetFile 类型声明文件的路径名称（相对于Lib模块根目录）。
 */
export function createDeclarations(
  modules: string[],
  fileTypes: string[],
  targetFile = 'lib/locale.d.ts'
) {
  const moduleExports = getModuleExports(modules)
  for (const module of moduleExports) {
    const { exports, context, packageModule } = module
    const codes = []
    for (const type of fileTypes) {
      codes.push(getResourceModuleCode(type, exports))
    }
    writeFileSync(path.join(context, targetFile), codes.join(''))
    appendReferenceToLib(module, targetFile)
    ensureDependencies(module.name, packageModule.version)
  }
}

// 确保模块依赖被正确声明
function ensureDependencies(moduleName: string, version: string) {
  const pkgPath = path.resolve('package.json')
  const pkgModule = require(pkgPath)
  const { dependencies = {}, devDependencies = {} } = pkgModule
  let needUpdate = false
  let depsVersion
  if ((depsVersion = devDependencies[moduleName])) {
    delete devDependencies[moduleName]
    needUpdate = true
  }
  if (!dependencies[moduleName]) {
    dependencies[moduleName] = depsVersion || `^${version}`
    needUpdate = true
  }
  if (!pkgModule.dependencies) {
    pkgModule.dependencies = dependencies
  }
  if (needUpdate) {
    writeFileSync(pkgPath, JSON.stringify(pkgModule, null, 2))
  }
}

// 追加引用声明到Lib的types声明文件
function appendReferenceToLib(
  module: ReturnType<typeof getModuleExports>[number],
  declarationFile: string
) {
  const { packageModule, context } = module
  const { types, typings } = packageModule as { types: string; typings: string }
  // 查找声明文件
  const typesPath = ensureFileHelper([types, typings, 'index.d.ts'], context)
  // 追加资源模块声明引用
  const refPath = path
    .relative(path.dirname(typesPath), path.join(context, declarationFile))
    .replace(/\\/g, '/')
  const refCode = `/// <reference path="${refPath.startsWith('.') ? '' : './'}${refPath}" />`
  const content = fs.readFileSync(typesPath, 'utf8')
  if (!new RegExp(`^\s*${escapeRegExpCharacters(refCode)}\s*$`, 'm').test(content)) {
    writeFileSync(typesPath, `${refCode}\n${content}`)
  }
  // 同步types声明
  packageModule.types = path.relative(context, typesPath).replace(/\\/g, '/')
  writeFileSync(path.join(context, 'package.json'), JSON.stringify(packageModule, null, 2))
}

// 检查文件路径列表，并确保存在至少一个文件（非目录）
// 最后一个文件会被创建，如果所有路径都不存在的话
function ensureFileHelper(paths: any[], context: string, createLast: boolean = true) {
  let file
  const tests = [...paths]
  while ((file = tests.shift())) {
    if (typeof file === 'string') {
      const filePath = path.join(context, file)
      if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        return filePath
      }
      if (!tests.length && createLast) {
        // 最后一个文件了，还不存在，创建这个文件
        writeFileSync(filePath, '')
        return filePath
      }
    }
  }
  return ''
}

// 写入内容到文件
function writeFileSync(filePath: string, content: string) {
  let file = filePath
  const unExistsDirs = []
  while (!fs.existsSync((file = path.dirname(file)))) {
    unExistsDirs.unshift(file)
  }
  for (const dir of unExistsDirs) {
    fs.mkdirSync(dir)
  }
  fs.writeFileSync(filePath, content)
}

// 资源模块导出代码
function getResourceModuleCode(type: string, exports: string) {
  return '\n' + `declare module ${JSON.stringify(`*.${type}`)} {\n${exports}\n}\n`
}

// 获取模块的接口导出定义
function getModuleExports(modules: string[]) {
  const loaders = requireModuleLoader(modules)
  const moduleExports = []
  for (const loader of loaders) {
    const {
      name,
      loader: { getModuleExports },
    } = loader
    if (typeof getModuleExports !== 'function') {
      // 检查模块导出接口是否存在
      throw new Error(`Can not find the export method named by getModuleExports for ${name}`)
    }
    const exports = getModuleExports({})
    if (typeof exports !== 'string') {
      throw new Error(`Module exports declaration of ${name} is not a string value`)
    }
    moduleExports.push({
      ...loader,
      exports,
    })
  }
  return moduleExports
}

// 解析模块的loader路径
export function requireModuleLoader(modules: string[]) {
  const loaders = []
  for (const name of modules) {
    // 解析模块的包描述文件路径
    const pkgPath = resolveModule(`${name}/package.json`)
    const context = path.dirname(pkgPath)
    const pkg = require(pkgPath)
    const pkgLoader = ensureFileHelper([pkg.loader, 'loader.js', 'lib/loader.js'], context, false)
    if (!pkgLoader) {
      throw new Error(`Can not get loader of module ${name}`)
    }
    loaders.push({
      name,
      context,
      loader: require(pkgLoader),
      packageModule: pkg as { [p: string]: string },
    })
  }
  return loaders
}

// 解析模块路径
export function resolveModule(name: string) {
  const cwd = fs.realpathSync(process.cwd())
  const selfDir = getSelfContext()
  let pkgPath = ''
  try {
    // 从当前工作目录解析依赖包
    pkgPath = require.resolve(name, { paths: [cwd] })
  } catch (e) {
    if (selfDir && cwd !== selfDir) {
      // 从自身模块目录解析依赖包
      // 模块自测时需要在当前模块下引入依赖包
      try {
        pkgPath = require.resolve(name, { paths: [selfDir] })
      } catch (e) {
        throw new Error(`Can not resolve module path of ${name}`)
      }
    }
  }
  return pkgPath
}
