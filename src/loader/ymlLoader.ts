import fs from 'fs'
import webpack from 'webpack'
import loaderUtils from 'loader-utils'
import parseIncludeAsync from '../lib/include'
import loadResources from '../lib/resource'
import { LoaderOptions, LoaderType } from '../Plugin'

type LoaderContext = webpack.loader.LoaderContext

async function loadLocales(this: LoaderContext, source: string) {
  const { error, warnings, files } = await parseIncludeAsync(
    source,
    this.resourcePath,
    this.fs as typeof fs
  )
  // 重设依赖信息
  this.clearDependencies()
  for (const { file } of files) {
    this.addDependency(file)
  }
  for (const warn of warnings) {
    this.emitWarning(warn)
  }
  if (error) {
    // 抛出编译异常
    throw error
  }
  // 处理资源加载
  const { warnings: resourceWarnings, data } = loadResources(files)
  for (const warn of resourceWarnings) {
    this.emitWarning(warn)
  }
  return data
}

/**
 * 解析yml格式的语言定义文件。
 */
const ymlLoader: LoaderType = function (this: LoaderContext, source: string | Buffer) {
  const options: any = loaderUtils.getOptions(this)
  const { esModule } = options as LoaderOptions
  const callback = this.async() || (() => {})
  //
  loadLocales
    .call(this, source as string)
    .then(
      (content) => `${esModule ? 'export default ' : 'module.exports='}${JSON.stringify(content)}`
    )
    .then((code) => callback(null, code))
    .catch(callback)
}

ymlLoader.test = /\.ya?ml$/
ymlLoader.resourceQuery = /ya?ml/
ymlLoader.filepath = __filename
ymlLoader.extensions = ['.yml', '.yaml']
export default ymlLoader
