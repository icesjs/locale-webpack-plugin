import fs from 'fs'
import path from 'path'
import {
  escapeRegExpCharacters,
  getSelfContext,
  isSamePath,
  normalizePath,
  writeFileSync,
} from './utils'

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

// 追加引用声明到工程的types声明文件
// 如果工程没有在代码里导入模块包，tsc不会去找已经在package.json里声明了的模块
// 只有在代码里导入了模块，tsc才会根据依赖解析规则去找声明文件
// 所以，这里还是需要把声明引用添加到工程的声明文件中去
function appendReferenceToProject(moduleName: string) {
  const cwd = fs.realpathSync(process.cwd())
  if (cwd === getSelfContext()) {
    return
  }
  const typesPath = ensureFileHelper(['src/react-app-env.d.ts', 'src/types.d.ts'], cwd)
  const refCode = `/// <reference types="${moduleName}" />`
  const content = fs.readFileSync(typesPath, 'utf8')
  if (!new RegExp(`^\s*${escapeRegExpCharacters(refCode)}\s*$`, 'm').test(content)) {
    writeFileSync(typesPath, `${refCode}\n${content}`)
  }
}

// 追加引用声明到Lib的types声明文件
function appendReferenceToLib(
  moduleDetails: ReturnType<typeof getModuleDetails>,
  declarationFile: string
) {
  const { packageModule, context } = moduleDetails
  const { types, typings } = packageModule as { types: string; typings: string }
  // 查找声明文件
  const typesPath = ensureFileHelper([types, typings, 'index.d.ts'], context)
  // 追加资源模块声明引用
  const refPath = normalizePath(path.join(context, declarationFile), path.dirname(typesPath))
  const refCode = `/// <reference path="${refPath}" />`
  const content = fs.readFileSync(typesPath, 'utf8')
  if (!new RegExp(`^\s*${escapeRegExpCharacters(refCode)}\s*$`, 'm').test(content)) {
    writeFileSync(typesPath, `${refCode}\n${content}`)
  }
  // 同步types声明
  if (!isSamePath(typesPath, packageModule.types, context)) {
    packageModule.types = normalizePath(typesPath, context)
    writeFileSync(path.join(context, 'package.json'), JSON.stringify(packageModule, null, 2))
  }
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

// 资源模块导出代码
function getResourceModuleCode(ext: string, declarationExports: string) {
  return (
    '\n' +
    `declare module ${JSON.stringify(
      `*${ext.startsWith('.') ? '' : '.'}${ext}`
    )} {\n${declarationExports}\n}\n`
  )
}

// 解析模块包描述文件路径
function resolveModulePackage(name: string) {
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

/**
 * 获取Locale组件模块的详情
 * @param name 模块名称
 */
export function getModuleDetails(name: string) {
  // 解析模块的包描述文件路径
  const pkgPath = resolveModulePackage(`${name}/package.json`)
  const context = path.dirname(pkgPath)
  const packageModule = require(pkgPath) as { [p: string]: string }
  const loaderPath = ensureFileHelper(
    [packageModule.loader, 'loader.js', 'lib/loader.js'],
    context,
    false
  )
  if (!loaderPath) {
    throw new Error(`Can not get loader of module ${name}`)
  }
  return {
    name,
    context,
    packageModule,
    loaderModule: require(loaderPath),
  }
}

/**
 * 创建资源模块的类型声明文件。
 * @param moduleDetails 可用于处理资源模块的Lib模块详情。
 * @param extensions 支持的资源类型后缀名称。
 * @param targetFile 类型声明文件的路径名称（相对于Lib模块根目录）。
 */
export function createDeclarations(
  moduleDetails: ReturnType<typeof getModuleDetails>,
  extensions: string[],
  targetFile: string
) {
  const { loaderModule, packageModule, context, name } = moduleDetails
  const { getModuleExports } = loaderModule
  if (typeof getModuleExports !== 'function') {
    throw new Error(`Can not find the export method named by getModuleExports for ${name}`)
  }
  const declarationExports = getModuleExports({})
  if (typeof declarationExports !== 'string') {
    throw new Error(`Module exports declaration of ${name} is not a string value`)
  }
  const declarationCodes = []
  for (const ext of extensions) {
    declarationCodes.push(getResourceModuleCode(ext, declarationExports))
  }
  writeFileSync(path.join(context, targetFile), declarationCodes.join(''))
  appendReferenceToLib(moduleDetails, targetFile)
  ensureDependencies(name, packageModule.version)
  appendReferenceToProject(name)
}
