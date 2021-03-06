import fs from 'fs'
import path from 'path'

/**
 * 简单判断当前的工程，是不是一个typescript工程。
 */
export function isTypeScriptProject() {
  const cwd = fs.realpathSync(process.cwd())
  try {
    for (const file of fs.readdirSync(cwd).reverse()) {
      if (/tsconfig(\..+?)*\.json$/i.test(file)) {
        const { dependencies = {}, devDependencies = {} } = require(path.join(cwd, 'package.json'))
        if (dependencies.typescript || devDependencies.typescript) {
          return !!require.resolve('typescript', { paths: [cwd] })
        }
        break
      }
    }
  } catch (e) {}
  return false
}

/**
 * 获取当前模块的根路径。
 */
export function getSelfContext() {
  const cwd = fs.realpathSync(process.cwd())
  let file = __filename
  while (!fs.existsSync(path.join((file = path.dirname(file)), 'package.json'))) {
    if (file === cwd || path.basename(file) === 'node_modules') {
      file = ''
      break
    }
  }
  if (file && path.dirname(file) !== file) {
    return file
  }
  try {
    if (require(path.join(file, 'package.json')).name === '@ices/locale-webpack-plugin') {
      return file
    }
  } catch (e) {}
  return ''
}

/**
 * 转义处理正则元字符。
 * @param str 待处理的字符串。
 */
export function escapeRegExpCharacters(str: string): string {
  return str.replace(/[|/\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

/**
 * 首字母大写。
 * @param str 待处理的字符串。
 */
export function capitalize(str: string) {
  return str[0].toUpperCase() + str.substr(1)
}

/**
 * 获取一个变量标识符生成器。
 * @param prefix 标识符前缀。
 * @param counter 用于同名变量计数的容器。
 */
export function getIdentifierMaker(prefix = '', counter: { [p: string]: number } = {}) {
  return (namespace = 'space') => {
    const identifier =
      `${prefix}${capitalize(
        namespace !== '/' ? namespace.replace(/[/\\](.)/g, ($0, $1) => $1.toUpperCase()) : 'glob'
      )}}`.replace(/[^_a-z$\d]/gi, '') || 'ident'
    const count = counter[identifier] || 0
    counter[identifier] = count + 1
    return `${identifier}${count || ''}`
  }
}

/**
 * 格式化路径。
 * @param filepath 文件路径
 * @param base 相对于该路径
 */
export function normalizePath(filepath: string, base?: string) {
  if (base) {
    filepath = path.relative(base, filepath)
  }
  filepath = filepath.replace(/\\/g, '/')
  if (base && filepath && !path.isAbsolute(filepath) && !filepath.startsWith('.')) {
    filepath = './' + filepath
  }
  return filepath || './'
}

/**
 * 判断两个路径是不是指向同一个文件
 * @param a a路径
 * @param b b路径
 * @param base 相对于该路径
 */
export function isSamePath(a: string, b: string, base: string = process.cwd()) {
  a = !path.isAbsolute(a) ? path.join(base, a) : path.normalize(a)
  b = !path.isAbsolute(b) ? path.join(base, b) : path.normalize(b)
  return a.replace(/[/\\]+$/, '') === b.replace(/[/\\]+$/, '')
}

/**
 * 获取格式化后的语言区域。
 * @param locale 需要格式化的区域语言代码字符串。
 * @return [lang-AREA, lang, AREA]
 */
export function normalizeLocale(locale?: string) {
  if (typeof locale !== 'string') {
    locale = ''
  }
  const [langArea] = locale.split('.')
  const [lang, area = ''] = langArea.split(/[-_]/)
  const lowerLang = lang.toLowerCase()
  const upperArea = area.toUpperCase()
  return [`${lowerLang}${area ? '-' + upperArea : ''}`, lowerLang, upperArea]
}

/**
 * 获取entries
 * @param obj
 */
export function getEntries(obj: any) {
  if (obj === null || typeof obj !== 'object') {
    return []
  }
  return Object.entries(obj)
}

// 获取指定路径上不存在的目录
function getUnExistsDirs(file: string) {
  const unExistsDirs = []
  while (!fs.existsSync((file = path.dirname(file)))) {
    unExistsDirs.unshift(file)
  }
  return unExistsDirs
}

/**
 * 同步写入文件。
 * @param filePath
 * @param content
 */
export function writeFileSync(filePath: string, content: string | Buffer) {
  for (const dir of getUnExistsDirs(filePath)) {
    fs.mkdirSync(dir)
  }
  fs.writeFileSync(filePath, content)
}
