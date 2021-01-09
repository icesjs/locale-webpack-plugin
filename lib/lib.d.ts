declare module '@craco/craco' {
  import { Configuration, RuleSetRule } from 'webpack'
  export function addBeforeLoader(
    config: Configuration,
    matcher: (rule: any) => boolean,
    rule: RuleSetRule
  ): { isAdded: boolean }
  export function loaderByName(name: string): (rule: RuleSetRule | string) => boolean
}

declare module '*.yml' {
  export {
    setLocale,
    getLocale,
    useLocale,
    Translate,
    Trans,
    LocaleContext,
    useLocale as default,
  } from '@ices/react-locale'
}

declare module '*.yaml' {
  import useLocale from '*.yml'
  export * from '*.yml'
  export default useLocale
}
