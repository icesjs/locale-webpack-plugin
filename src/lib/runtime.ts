/**
 * 这个文件需要在浏览器端运行。
 * 不要在这个里面写任何与 nodejs api 有关的代码。
 */
//
type DataType = string | number | boolean | object | null | undefined
type ParsedDataType = Exclude<DataType, undefined>
type LocaleData = { [key: string]: Exclude<ParsedDataType, object> }
type LocaleDataSet = { [locale: string]: LocaleData }

/**
 * 对象自身属性检查。
 * @param obj
 * @param prop
 */
function hasOwnProperty(obj: object, prop: string) {
  // @ts-ignore
  return Object.hasOwn ? Object.hasOwn(obj, prop) : Object.prototype.hasOwnProperty.call(obj, prop)
}

/**
 * 合并本地化消息数据。
 * @param dataList 已经解析的数据列表。
 */
export default function merge(dataList: LocaleDataSet[]) {
  const dataSet: LocaleDataSet = {}
  for (const dataItem of dataList) {
    for (const [locale, data] of Object.entries(dataItem)) {
      if (hasOwnProperty(dataSet, locale)) {
        dataSet[locale] = { ...dataSet[locale], ...data }
      } else {
        dataSet[locale] = data
      }
    }
  }
  return dataSet
}
