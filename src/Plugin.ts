import webpack from 'webpack'
import { addLoaderBefore, isTypeScriptProject } from './lib/utils'
import reactLoader from './loader/reactLoader'
import ymlLoader from './loader/ymlLoader'
import localeLoader from './loader/localeLoader'
import { createDeclarations, resolveModule } from './lib/module'

/**
 * 模块组件的类型。
 */
enum ComponentType {
  react = 'react',
  // vue = 'vue',
}

export interface PluginOptions {
  /**
   * 语言定义文件的名称匹配正则表达式。
   * 用于对匹配到的文件进行模块化处理。
   * 默认匹配yml后缀格式文件。
   */
  test?: RegExp
  /**
   * 是否使用es模块导出代码。
   * 默认为 true。
   */
  esModule?: boolean
  /**
   * 是否是 typescript 工程。
   * 默认为自动检测工程根目录下是否包含 tsconfig(.xxx)*.json
   * 以及 package.json 里是否声明了 typescript 依赖
   * 并且检查 typescript 依赖是否已经安装。
   * 是 typescript 工程会则创建资源模块的类型声明文件，以便提供代码智能提示和校验。
   * 可以手动指定为 typescript 工程，以强制创建类型声明文件。
   * 类型声明文件放置在依赖包的目录下面( node_modules 里)，并不会给当前工程添加额外文件。
   */
  typescript?: boolean

  /**
   * 需要使用的模块组件的类型。
   * 目前可选值为 react ，暂不支持 vue 。
   * 默认根据安装的依赖包自动设置。
   */
  componentType?: ComponentType
}

/**
 * 组件库构建加载器接口定义。
 */
export interface LibModuleLoader {
  getModuleCode(opts: { module: string; esModule: boolean; resourcePath: string }): string
  getModuleExports(): string
}

export type LoaderType = {
  test?: RegExp
  filepath: string
  libModuleName?: string
  resourceQuery?: webpack.RuleSetCondition
}

//
class LocalePlugin implements webpack.Plugin {
  constructor(readonly options: PluginOptions = {}) {
    this.setComponentType()
    this.setLibModule()
    if (!this.componentType || !this.libModule) {
      throw new Error(
        'Can not find any package for generating code of locale module, you should install it first: ' +
          reactLoader.libModuleName +
          '\n'
      )
    }

    // 生成资源模块类型声明文件
    if (this.options.typescript || isTypeScriptProject()) {
      createDeclarations([this.libModule], this.fileTypes)
    }
  }

  // 当前已经支持解析的语言定义文件格式
  private fileTypes = ['yml', 'yaml']
  // 当前使用的资源模块组件类型
  private componentType: ComponentType = ComponentType.react
  // 处理资源模块内容的Lib模块依赖，用来声明类型定义文件，以及资源模块代码
  private libModule = reactLoader.libModuleName as string

  /**
   * 设置模块组件类型。
   */
  setComponentType() {
    const { componentType } = this.options
    if (componentType) {
      this.componentType = componentType
    } else {
      try {
        if (resolveModule(reactLoader.libModuleName as string)) {
          this.componentType = ComponentType.react
        } else {
          // vue 暂未支持
        }
      } catch (e) {}
    }
  }

  /**
   * 设置处理模块资源的依赖包。
   */
  setLibModule() {
    if (this.componentType === ComponentType.react) {
      this.libModule = reactLoader.libModuleName as string
    } else {
      // vue 暂未支持
    }
  }

  /**
   * 应用webpack插件。
   * @param compiler
   */
  apply(compiler: webpack.Compiler) {
    const { componentType } = this
    const { test = /\.ya?ml$/ } = this.options
    const { options = {} } = compiler
    const rule = {
      // 默认对yml格式文件进行解析
      test,
      enforce: 'pre' as 'pre',
      oneOf: [
        componentType === ComponentType.react && this.getLoaderRule(reactLoader),
        this.getLoaderRule(ymlLoader),
        this.getLoaderRule(localeLoader),
      ].filter(Boolean) as webpack.RuleSetRule[],
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
    const { fileTypes, componentType } = this
    const { esModule = true } = this.options
    return {
      test,
      resourceQuery,
      loader: filepath,
      options: {
        esModule,
        fileTypes: fileTypes.join('&'),
        componentType: componentType,
      },
    }
  }
}

export default LocalePlugin
