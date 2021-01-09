import webpack from 'webpack'
import { addLoaderBefore } from './lib/utils'
import reactLoader from './loader/reactLoader'
import ymlLoader from './loader/ymlLoader'
import localeLoader from './loader/localeLoader'

export interface PluginOptions {
  /**
   * 语言定义文件的名称匹配正则表达式。
   * 用于对匹配到的文件进行模块化处理。
   * 默认匹配yml后缀格式文件。
   */
  test?: RegExp
  /**
   * 是否使用es模块导出代码。
   */
  esModule?: boolean
}

export interface LoaderType {
  test?: RegExp
  filepath: string
  resourceQuery?: webpack.RuleSetCondition
}

class LocalePlugin implements webpack.Plugin {
  constructor(readonly options: PluginOptions = {}) {}
  // 当前已经支持解析的语言定义文件格式
  private readonly fileTypes = ['yml', 'yaml']
  // 当前已经支持可导出的语言模块组件类型
  private readonly componentTypes = ['react']

  /**
   * 应用webpack插件。
   * @param compiler
   */
  apply(compiler: webpack.Compiler) {
    const { test = /\.ya?ml$/ } = this.options
    const { options = {} } = compiler
    const rule = {
      // 默认对yml格式文件进行解析
      test,
      enforce: 'pre' as 'pre',
      oneOf: [
        this.getLoaderRule(reactLoader),
        this.getLoaderRule(ymlLoader),
        this.getLoaderRule(localeLoader),
      ],
    }
    addLoaderBefore(options, rule, ['file-loader', 'url-loader'])
  }

  /**
   * 获取规则定义。
   * @param filepath
   * @param test
   * @param resourceQuery
   */
  getLoaderRule({ filepath, test, resourceQuery }: LoaderType): webpack.RuleSetRule {
    const { fileTypes, componentTypes } = this
    const { esModule = true } = this.options
    return {
      test,
      resourceQuery,
      loader: filepath,
      options: {
        esModule,
        fileTypes: fileTypes.join('&'),
        componentTypes: componentTypes.join('&'),
      },
    }
  }
}

export default LocalePlugin
