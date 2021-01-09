/**
 * 语言定义模块。
 */
declare module '*.yml' {
  export {
    setLocale,
    getLocale,
    useLocale,
    Translate,
    Trans,
    useLocale as default,
  } from '@ices/react-locale'
}

/**
 * 语言定义模块。
 */
declare module '*.yaml' {
  import useLocale from '*.yml'
  export * from '*.yml'
  export default useLocale
}
