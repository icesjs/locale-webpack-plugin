/**
 * 指令解析规则：
 * 类似于 c 语言的 #include 指令，选择 # 开头是因为，# 在 yml 里表示注释，不会破坏原有语言规范，文件也能由其他解析器正常解析
 * - 每一条 include 指令，都应该以单独的一行声明，且有效内容以 #include 开头
 * - \#include "xxx"、#include 'xxx'、#include xxx  以当前上下文目录为根目录匹配相对路径
 * - \#include <xxx>  以 node_modules 目录为根目录匹配"绝对"路径
 * - \#include "./xxx"、#include "../xxx"、#include "xxx" 为有效指令，即都是从当前上下文目录起计算相对路径匹配
 * - \#include <./xxx> 、#include <../xxx>、#include </xxx> 为无效指令，即从 node_modules 目录匹配时，不能使用相对路径或斜杠开头路径
 * - \#include <.xxx> 为有效路径，表示 node_modules 目录下面的 .xxx 文件
 * - ••#include••"••xxx••"••、••#include••<••xxx••>•• 为有效指令，其中••为空格字符
 *
 * 文件名解析规则：
 * 不带后缀时，以 .yml 和 .yaml 为规则进行解析
 * 文件为目录时，以目录下面的 index.yml 和 index.yaml 进行解析
 */

import fs from 'fs'
import path from 'path'
import { normalizePath } from './utils'

// 匹配指令声明的正则表达式
// 0号元素为指令 分组1为引号、分组2为contextPath、分组3为modulePath
const directiveRegx = /^\s*#include(?=[<'"\s](?!['"<>.\\/\s;]*$))\s*(?:(['"]?)\s*([^'"<>:*?|]+?)\s*\1|<(?!\s*(?:\.*[/\\]|\.{2,}))\s*([^'"<>:*?|]+?)\s*>)[\s;]*$/gm
// 检查指令是否正确的正则表达式
const checkDirectiveRegx = /^\s*#\s*include(?:[<'"]|\s(?!\s*$)).*$/gm
// 解析文件名称的后缀
const resolveExtensions = ['.yml', '.yaml']
// 当前工作目录
const cwd = fs.realpathSync(process.cwd())

// 文件节点类型定义
export type FileNodeType = {
  context: string // 文件所在目录
  exists: boolean // 是否存在
  file: string // 文件路径
  source: string // 原始内容
  content?: string // 处理了导入后的内容
  isDir?: boolean // 是否是目录文件
  children?: FileNodeType[] // 导入的文件节点列表
  cycleIncluded?: boolean // 是否为循环导入的文件
  warnings?: Warning[] // 警告信息
}

/**
 * 用于去除警告信息的堆栈内容。
 */
class Warning extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Warning'
    this.message = `Warning: (include resource) ${message}`
    this.stack = ''
  }
}

// 获取匹配正则
function getDirectiveRegx() {
  // 因为是正则是循环匹配，文件是递归遍历，所以这里每一个节点用的匹配正则都重新实例化一个
  return new RegExp(directiveRegx.source, directiveRegx.flags)
}

/**
 * 读取文件内容。
 * @param file 文件路径
 * @param fileSystem 文件系统
 */
async function readFileAsync(file: string, fileSystem: typeof fs = fs): Promise<FileNodeType> {
  const fileNode = { file, context: path.dirname(file), source: '' } as FileNodeType
  try {
    // 这里的文件系统可能由调用方传参，比如使用webpack的内存缓存文件系统
    const stats = await new Promise<fs.Stats>((resolve, reject) => {
      fileSystem.stat(file, (err, stats) => (err ? reject(err) : resolve(stats)))
    })
    if (stats.isSymbolicLink()) {
      const realPath = fs.realpathSync(file)
      if (realPath !== file) {
        return await readFileAsync(realPath, fileSystem)
      }
    }
    fileNode.isDir = stats.isDirectory()
    if (!fileNode.isDir) {
      const source = await new Promise<Buffer>((resolve, reject) => {
        fileSystem.readFile(file, (err, content) => (err ? reject(err) : resolve(content)))
      })
      fileNode.source = source.toString('utf8')
    }
    fileNode.exists = true
  } catch (e) {
    fileNode.exists = false
  }
  return fileNode
}

/**
 * 解析并读取文件内容。
 * 如果文件是目录，会从该目录下读取 index[.ext]
 * @param filePath 文件路径
 * @param fileSystem 文件系统
 */
async function resolveFile(filePath: string, fileSystem?: typeof fs) {
  const fileNode = await readFileAsync(filePath, fileSystem)
  const { file, isDir, exists } = fileNode
  if (isDir) {
    for (const ext of resolveExtensions) {
      // 解析目录，以index[.ext]解析文件
      const indexFileNode = await readFileAsync(path.join(file, `index${ext}`), fileSystem)
      const { exists, isDir } = indexFileNode
      if (exists && !isDir) {
        return indexFileNode
      }
    }
  } else if (!exists) {
    const extName = path.extname(file)
    for (const ext of resolveExtensions) {
      if (ext === extName) {
        continue
      }
      // 以附加后缀名解析
      const extFileNode = await readFileAsync(file + ext, fileSystem)
      const { exists, isDir } = extFileNode
      if (exists && !isDir) {
        return extFileNode
      }
    }
  }
  return fileNode
}

/**
 * 从文件内容中解析include指令。
 * 返回所有按导入顺序依赖的文件列表。
 * @param fileNode
 * @param parentFileNode
 * @param resolvedFileMap
 * @param fileSystem
 */
async function parseDirective(
  fileNode: FileNodeType,
  parentFileNode: FileNodeType | null,
  resolvedFileMap: { [key: string]: FileNodeType },
  fileSystem?: typeof fs
) {
  if (!fileNode.children) {
    fileNode.children = []
  }

  const { context, children, source } = fileNode
  const regx = getDirectiveRegx()
  const contents = []
  let contentsLastIndex = 0
  let matched

  // 这里的正则是多行匹配模式
  while ((matched = regx.exec(source))) {
    // 0号位为指令、1号位为引号、2号位为相对路径、3号位为node_modules路径
    const [directive, , contextPath, modulePath] = matched
    contents.push(source.substring(contentsLastIndex, matched.index))
    contentsLastIndex = regx.lastIndex

    const includePath = contextPath
      ? // 从当前目录的相对路径导入
        path.join(context, contextPath)
      : // 从 node_modules 导入
        path.join(cwd, 'node_modules', modulePath)

    // 解析文件
    const resolvedFile =
      resolvedFileMap[includePath] || (await resolveFile(includePath, fileSystem))

    const { file } = resolvedFile
    const prevIncluded = resolvedFileMap[file]
    resolvedFileMap[includePath] = prevIncluded || resolvedFile
    resolvedFileMap[file] = prevIncluded || resolvedFile

    if (file === fileNode.file) {
      // 自己导入自己
      continue
    }
    // 检查文件信息，如果不存在则抛异常退出解析
    checkExists(resolvedFile, fileNode, directive)

    if (prevIncluded) {
      // 已经发起过解析的文件，可能还未处理完成解析，这里标记下，然后在整体解析完成后，展开其子节点列表到对应位置
      children.push({ ...resolvedFile, cycleIncluded: true })
      // 这里也为排除循环解析的情况
      continue
    }

    // 解析导入文件里的其他导入
    children.push(...(await parseDirective(resolvedFile, fileNode, resolvedFileMap, fileSystem)))
  }

  // 检查文件是否使用了不符合语法的#include指令，并给出提示
  contents.push(source.substring(contentsLastIndex))
  checkContents(contents.map((str) => str.replace(/^\r?\n/, '')).join(''), fileNode, parentFileNode)

  // 合并引入，并返回包含导入文件和自身的文件列表
  return (
    fileNode.children
      .reduce((list, included) => {
        // 如果是重复的导入，则不添加进导入文件列表里
        // 循环导入的，在整体处理完成后再展开时，排除重复
        if (included.cycleIncluded || !list.some((item) => item.file === included.file)) {
          list.push(included)
        }
        return list
      }, [] as FileNodeType[])
      // 包含自身文件
      .concat(fileNode)
  )
}

/**
 * 格式化文件打印路径。
 * @param fileNode
 * @param parentFileNode
 */
function printFilePath(fileNode: FileNodeType, parentFileNode: FileNodeType | null) {
  const { file } = fileNode
  const filePath = normalizePath(file, cwd)
  let includedBy
  if (parentFileNode) {
    const parentPath = normalizePath(parentFileNode.file, cwd)
    includedBy = ` (included by: ${parentPath})`
  } else {
    includedBy = ''
  }
  return filePath + includedBy
}

/**
 * 检查文件是否存在。如果不存在抛出异常，并结束解析。
 * @param fileNode
 * @param parentFileNode
 * @param directive
 */
function checkExists(
  fileNode: FileNodeType,
  parentFileNode: FileNodeType | null,
  directive: string
): boolean | never {
  const { exists, isDir } = fileNode
  if (!exists || isDir) {
    throw new Error(
      `[${directive.trim()}] Can not resolve the file: ${printFilePath(fileNode, parentFileNode)}`
    )
  }
  return true
}

/**
 * 检查不符合语法的导入指令，并给出提示
 * @param content
 * @param fileNode
 * @param parentFileNode
 */
function checkContents(
  content: string,
  fileNode: FileNodeType,
  parentFileNode: FileNodeType | null
) {
  const matched = content.match(checkDirectiveRegx)
  if (matched) {
    if (!fileNode.warnings) {
      fileNode.warnings = []
    }
    fileNode.warnings.push(
      new Warning(
        `Directive syntax error: ${matched
          .map((str) => `[${str.trim()}]`)
          .join(' ')}\n${printFilePath(fileNode, parentFileNode)}`
      )
    )
  }
}

/**
 * 获取警告信息
 * @param fileNodeMaps 已解析的文件集map
 */
function serializeWarnings(fileNodeMaps: { [key: string]: FileNodeType }) {
  const warningsMap: { [key: string]: Warning[] } = {}
  for (const { file, warnings } of Object.values(fileNodeMaps)) {
    if (warningsMap[file] || !warnings || !warnings.length) {
      continue
    }
    warningsMap[file] = warnings
  }
  return Object.values(warningsMap).reduce((array, item) => {
    array.push(...item)
    return array
  }, [])
}

/**
 * 输出合并导入后的文件列表。
 * 按数组正序解析，后面的元素覆盖前面元素的内容即可。
 * @param fileNodes 待合并的导入文件列表。
 */
function serializeFiles(fileNodes: FileNodeType[]) {
  // 展开循环导入的文件
  const fileList: FileNodeType[] = []
  for (const node of fileNodes) {
    if (node.cycleIncluded && node.children) {
      for (const child of node.children) {
        if (!fileList.some((item) => item.file === child.file)) {
          fileList.push(child)
        }
      }
    }
    if (!fileList.some((item) => item.file === node.file)) {
      fileList.push(node)
    }
  }
  return fileList.map(({ file, source, context }) => ({ file, source, context }))
}

/**
 * 解析yml文件导入指令。
 * @param file 待解析文件的路径。
 * @param fileSystem webpack可缓存的文件系统。
 */
export default async function parseIncludeAsync(file: string, fileSystem?: typeof fs) {
  const fileNode = await readFileAsync(file, fileSystem)
  const resolvedFileMap = {
    [fileNode.file]: fileNode,
  }
  try {
    const fileNodes = await parseDirective(fileNode, null, resolvedFileMap, fileSystem)
    // 将结果按导入的顺序整理后返回
    return {
      files: serializeFiles(fileNodes.concat(fileNode)),
      warnings: serializeWarnings(resolvedFileMap),
      error: null,
    }
  } catch (error) {
    // 将已解析的文件列表返回，因为需要添加依赖信息，好在文件更新时，触发重新构建
    return {
      files: serializeFiles(Object.values(resolvedFileMap).concat(fileNode) as FileNodeType[]),
      warnings: serializeWarnings(resolvedFileMap),
      error,
    }
  }
}
