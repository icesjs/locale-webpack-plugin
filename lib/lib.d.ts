/**
 * 语言定义模块。
 */
declare module '*.yml' {
  export {
    /**
     * 全局设置当前的区域语言值。
     */
    setLocale,
    /**
     * 获取全局当前设置的区域语言值。
     */
    getLocale,
    /**
     * 可应用于函数组件内的hooks，用于使用区域语言模块。
     */
    useLocale,
    /**
     * 转译组件。一般应用于类型组件中。
     */
    Translate,
    /**
     * Translate 的别名组件。
     */
    Trans,
    /**
     * 绑定至当前模块的语言模块中所定义的内容。插件可获取此值，并在插件 translate 函数中使用。
     */
    definitions,
    /**
     * 一些可用于语言模块的工具函数。
     */
    utils,
    /**
     * 模块内部定义的语言内容转换插件。
     */
    plugins,
    /**
     * 可订阅全局语言变化的函数。
     */
    subscribe,
    /**
     * 可应用于函数组件内的hooks，用于使用区域语言模块。
     */
    useLocale as default,
  } from '@ices/react-locale'
}

/**
 * 语言定义模块。
 */
declare module '*.yaml' {
  import useLocale from '*.yml'
  export * from '*.yml'
  /**
   * 可应用于函数组件内的hooks，用于使用区域语言模块。
   */
  export default useLocale
}
