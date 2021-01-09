import webpack from 'webpack'
import { addBeforeLoader } from './utils'
import ymlLoaderModule from './ymlLoader'
const ymlLoader = require.resolve('./ymlLoader')

interface PluginOptions {
  [key: string]: any
}

// 语言模块解析加载插件
class LocalePlugin implements webpack.Plugin {
  static ymlLoader = ymlLoaderModule
  constructor(readonly options: PluginOptions = {}) {}

  apply(compiler: webpack.Compiler) {
    const { options = {} } = compiler
    compiler.options = options
    const rule = Object.assign(
      {
        test: /\.ya?ml$/,
      },
      this.options,
      {
        loader: ymlLoader,
      }
    )
    addBeforeLoader(options, rule, ['file-loader', 'url-loader'])
  }
}

export default LocalePlugin
