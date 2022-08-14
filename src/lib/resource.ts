/**
 * 资源加载规则：
 * 格式：
 * {
 *   key: string value 作为语言内容加载，语言设置名称为文件名
 *   zh: {
 *     key: string value 作为语言内容加载，语言设置为对象所属属性名
 *   }
 * }
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { normalizePath } from './utils'
import { DataType, ParsedDataType } from './merge'

type LoadResult = { data: ParsedDataType; warnings: Warning[] }

const cwd = fs.realpathSync(process.cwd())

/**
 * 用于去除警告信息的堆栈内容。
 */
class Warning extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Warning'
    this.message = `Warning: (locale resource) ${message}`
    this.stack = ''
  }
}

/**
 * 加载并解析YML文件。
 * @param source
 */
function loadYmlFile(source: string) {
  const warnings: Warning[] = []
  const data: DataType = yaml.load(source, {
    json: true,
    onWarning: (warn) => warnings.push(new Warning(warn.message)),
  }) as DataType
  return { warnings, data }
}

/**
 * 根据扩展名列表，对文件进行分类加载。
 * @param source
 * @param ext 资源扩展名称
 */
function loadFile(source: string, ext: string) {
  let res
  switch (ext.toLowerCase()) {
    case '.yml':
    case '.yaml':
      res = loadYmlFile(source)
      break
    default:
      res = { warnings: [] }
  }
  const { data = {}, warnings } = res
  return { data, warnings }
}

/**
 * 获取以文件名作为locale代码的值
 * @param file
 */
function getFileLocaleName(file: string) {
  return path.basename(file).replace(/\.[^.]*$/, '')
}

/**
 * 检查非键值对数据时，消息内容是否有效。
 * @param locale 区域语言代码
 * @param data 待检查的数据对象
 * @param file
 */
function checkObject(locale: string, data: object, file: string) {
  const warnings: Warning[] = []
  for (const entry of Object.entries(data)) {
    const [key, val] = entry as [string, ParsedDataType]
    if (val !== null && typeof val === 'object') {
      warnings.push(
        new Warning(
          `Localized message content cannot be an object: [${locale}: ${key}] ${normalizePath(
            file,
            cwd
          )}`
        )
      )
    }
  }
  return warnings
}

/**
 * 检查数据是否有效，并给出警告提示。
 * @param data 待合并的已解析数据。
 * @param file 数据来源文件的路径。
 */
function check(data: LoadResult['data'], file: string) {
  const warnings: Warning[] = []
  if (data === null || typeof data !== 'object') {
    if (data !== null) {
      warnings.push(
        new Warning(`Localized data must be defined as an object: ${normalizePath(file, cwd)}`)
      )
    }
  } else {
    let containsKVPairs = false
    let containsObject = false
    for (const entry of Object.entries(data)) {
      const [key, val] = entry as [string, ParsedDataType]
      if (val === null || typeof val !== 'object') {
        containsKVPairs = true
        continue
      }
      containsObject = true
      warnings.push(...checkObject(key, val, file))
    }
    if (containsObject && containsKVPairs) {
      warnings.push(
        new Warning(
          `It is better not to mix objects and common key value pairs in the same file to define localized message content: ${normalizePath(
            file,
            cwd
          )}`
        )
      )
    }
  }

  return warnings
}

/**
 * 解析加载本地化消息内容。
 * @param source 文件内容。
 * @param file 文件路径。
 */
export default function loadResource(source: string | Buffer, file: string) {
  if (Buffer.isBuffer(source)) {
    source = source.toString('utf8')
  }
  const warningList = []
  const { warnings, data } = loadFile(source, path.extname(file))
  warningList.push(...warnings)
  warningList.push(...check(data, file))
  return {
    locale: getFileLocaleName(file),
    warnings: warningList,
    data,
  }
}
