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

import path from 'path'
import yaml from 'js-yaml'

type DataType = string | number | boolean | object | null | undefined
type ParsedDataType = Exclude<DataType, undefined>
type LoadResult = { data: ParsedDataType; warnings: Warning[] }
type LocaleData = { [key: string]: Exclude<ParsedDataType, object> }
type LocaleDataSet = { [locale: string]: LocaleData }

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
  })
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
 * 合并本地化数据
 * @param dataSet 本地化数据集
 * @param locale 区域语言代码
 * @param data 待合并的数据
 */
function mergeLocaleData(dataSet: LocaleDataSet, locale: string, data: LocaleData) {
  let localeData: LocaleData = dataSet[locale]
  if (!localeData) {
    dataSet[locale] = localeData = {}
  }
  for (const [key, val] of Object.entries(data)) {
    localeData[key] = val
  }
}

/**
 * 合并本地化消息对象
 * @param dataSet 本地化数据集
 * @param locale 区域语言代码
 * @param data 待合并的消息对象
 * @param file
 */
function mergeLocaleObject(dataSet: LocaleDataSet, locale: string, data: object, file: string) {
  const warnings: Warning[] = []
  const localeData: LocaleData = {}
  for (const entry of Object.entries(data)) {
    const [key, val] = entry as [string, ParsedDataType]
    if (val !== null && typeof val === 'object') {
      localeData[key] = ''
      warnings.push(
        new Warning(`Localized message content cannot be an object: [${locale}: ${key}] ${file}`)
      )
    } else {
      localeData[key] = val
    }
  }
  mergeLocaleData(dataSet, locale, localeData)
  return warnings
}

/**
 * 合并解析数据
 * @param dataSet 本地化内容数据集
 * @param data 带合并的已解析数据
 * @param file 数据来源文件的路径
 */
function merge(dataSet: LocaleDataSet, data: LoadResult['data'], file: string) {
  const warnings: Warning[] = []
  if (data === null || typeof data !== 'object') {
    if (data !== null) {
      warnings.push(new Warning(`Localized data must be defined as an object: ${file}`))
    }
  } else {
    let containsObject = false
    const localeData: LocaleData = {}
    for (const entry of Object.entries(data)) {
      const [key, val] = entry as [string, ParsedDataType]
      if (val === null || typeof val !== 'object') {
        localeData[key] = val
        continue
      }
      containsObject = true
      // 对象优先合并进 localeDataSet
      warnings.push(...mergeLocaleObject(dataSet, key, val, file))
    }
    const containsKVPairs = !!Object.keys(localeData).length
    if (containsKVPairs) {
      // 以文件名作为locale代码
      mergeLocaleData(dataSet, getFileLocaleName(file), localeData)
    }
    if (containsObject && containsKVPairs) {
      warnings.push(
        new Warning(
          `It is better not to mix objects and common key value pairs in the same file to define localized message content: ${file}`
        )
      )
    }
  }

  return warnings
}

/**
 * 解析加载本地化消息内容。
 * @param fileList 待解析的文件列表
 */
export default function loadResources(fileList: { file: string; source: string }[]) {
  const warningList = []
  const dataSet: LocaleDataSet = {}
  for (const { source, file } of fileList) {
    const { warnings, data } = loadFile(source, path.extname(file))
    warningList.push(...warnings)
    warningList.push(...merge(dataSet, data, file))
  }
  return {
    warnings: warningList,
    data: dataSet,
  }
}
