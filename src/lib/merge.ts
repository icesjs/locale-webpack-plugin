/**
 * 这个文件需要在浏览器端运行。
 * 不要在这个里面写任何与 nodejs api 有关的代码。
 */
//
export type DataType = string | number | boolean | object | null | undefined
export type ParsedDataType = Exclude<DataType, undefined>
export type LocaleData = { [key: string]: Exclude<ParsedDataType, object> }
export type LocaleDataSet = { [locale: string]: LocaleData }

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
 */
function mergeLocaleObject(dataSet: LocaleDataSet, locale: string, data: object) {
  const localeData: LocaleData = {}
  for (const entry of Object.entries(data)) {
    const [key, val] = entry as [string, ParsedDataType]
    if (val !== null && typeof val === 'object') {
      localeData[key] = ''
    } else {
      localeData[key] = val
    }
  }
  mergeLocaleData(dataSet, locale, localeData)
}

/**
 * 进行合并。
 * @param dataSet 本地化内容数据集。
 * @param data 待合并的已解析的数据。
 * @param locale 当locale取文件名时，需要传这个值。
 */
function mergeData(dataSet: LocaleDataSet, data: ParsedDataType, locale?: string) {
  if (data === null || typeof data !== 'object') {
    return
  }
  const localeData: LocaleData = {}
  for (const entry of Object.entries(data)) {
    const [key, val] = entry as [string, ParsedDataType]
    if (val === null || typeof val !== 'object') {
      localeData[key] = val
      continue
    }
    mergeLocaleObject(dataSet, key, val)
  }
  if (locale && Object.keys(localeData).length) {
    mergeLocaleData(dataSet, locale, localeData)
  }
}

/**
 * 合并本地化消息数据。
 * @param dataList 已经解析的数据列表。
 */
export default function merge(dataList: { data: ParsedDataType; locale?: string }[]) {
  const dataSet: LocaleDataSet = {}
  for (const { data, locale } of dataList) {
    mergeData(dataSet, data, locale)
  }
  return dataSet
}
