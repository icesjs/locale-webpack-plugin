import webpack from 'webpack'
import { addLoaderBefore, isTypeScriptProject } from './lib/utils'
import { createDeclarations, getModuleDetails } from './lib/module'
import localeLoader from './loader/localeLoader'
import ymlLoader from './loader/ymlLoader'

export interface LoaderType extends webpack.loader.Loader {
  test?: RegExp
  filepath: string
  libName?: string
  resourceQuery?: webpack.RuleSetCondition
  extensions?: string[]
  [key: string]: any
}

interface ComponentLoader {
  getModuleCode(opts: { module: string; esModule: boolean; resourcePath: string }): string
  getModuleExports(): string
}

export type LoaderOptions = {
  esModule: boolean
  extensions: string[]
  generator: ComponentLoader['getModuleCode']
}

type PluginOptions = {
  /**
   * 语言定义文件的名称匹配正则表达式。
   * 用于对匹配到的文件进行模块化处理。
   * 默认匹配yml后缀格式文件。
   */
  test?: RegExp | RegExp[]
  /**
   * 是否使用es模块导出代码。
   * 默认为 true。
   */
  esModule?: boolean
  /**
   * 需要使用的模块组件的类型。
   * 目前可选值为 react ，暂不支持 vue 。
   * 默认值为 react。
   */
  componentType?: ComponentType
  /**
   * 是否是 typescript 工程。
   * 默认为自动检测工程根目录下是否包含 tsconfig(.xxx)*.json
   * 以及 package.json 里是否声明了 typescript 依赖
   * 并且检查 typescript 依赖是否已经安装。
   * 是 typescript 工程会则创建资源模块的类型声明文件，以便提供代码智能提示和校验。
   * 可以手动指定为 typescript 工程，以强制创建类型声明文件。
   */
  typescript?: boolean
}

/**
 * 使用的组件类型。
 * 暂未提供vue组件。
 */
enum ComponentType {
  react = 'react',
  vue = 'vue',
}

/**
 * 用于加载解析语言定义文件至组件模块的webpack插件。
 */
export default class LocaleWebpackPlugin implements webpack.Plugin {
  private readonly options: PluginOptions
  private readonly fileLoaders: LoaderType[]
  private readonly extensions: string[]
  private readonly moduleGenerator: (opts: {
    module: string
    esModule: boolean
    resourcePath: string
  }) => string

  constructor(options?: PluginOptions) {
    this.fileLoaders = [ymlLoader]
    this.options = Object.assign(
      {
        test: this.fileLoaders.map(({ test }) => test),
        componentType: ComponentType.react,
        esModule: true,
      },
      options
    )
    const { componentType, typescript } = this.options
    const moduleDetails = this.getLibModuleDetails(componentType)
    this.moduleGenerator = this.getModuleGenerator(moduleDetails)
    this.extensions = this.getSupportedExtensions()
    if (typeof typescript === 'boolean' ? typescript : isTypeScriptProject()) {
      createDeclarations(moduleDetails, this.extensions, 'lib/locale.d.ts')
    }
  }

  getLibModuleDetails(componentType?: ComponentType) {
    let moduleDetails: ReturnType<typeof getModuleDetails> | null = null
    switch (componentType) {
      case ComponentType.react:
        moduleDetails = getModuleDetails('@ices/react-locale')
        break
      case ComponentType.vue:
        // exports = getModuleExports(['@ices/vue-locale'])
        break
    }
    if (!moduleDetails) {
      throw new Error(`There is no corresponding component loader for ${componentType}`)
    }
    return moduleDetails
  }

  getModuleGenerator({ loaderModule, name }: { loaderModule: ComponentLoader; name: string }) {
    const { getModuleCode } = loaderModule
    if (typeof getModuleCode !== 'function') {
      throw new Error(`There is no corresponding code generator (${name})`)
    }
    return getModuleCode
  }

  getSupportedExtensions() {
    const extSet = new Set<string>()
    for (const { extensions } of this.fileLoaders) {
      if (Array.isArray(extensions)) {
        for (const ext of extensions) {
          extSet.add(ext.replace(/^\./, ''))
        }
      }
    }
    return [...extSet]
  }

  getLoaderRule({ filepath, test, resourceQuery }: LoaderType): webpack.RuleSetRule {
    const {
      options: { esModule },
      extensions,
      moduleGenerator,
    } = this
    //
    return {
      test,
      resourceQuery,
      loader: filepath,
      options: {
        esModule,
        extensions,
        generator: moduleGenerator,
      },
    }
  }

  apply(compiler: webpack.Compiler) {
    const rule = {
      test: this.options.test,
      enforce: 'pre' as 'pre',
      oneOf: [
        ...this.fileLoaders.map((loader) => this.getLoaderRule(loader)),
        this.getLoaderRule(localeLoader),
      ],
    }
    addLoaderBefore(compiler.options, rule, ['file-loader', 'url-loader'])
  }
}
