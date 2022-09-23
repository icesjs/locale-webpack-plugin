import crypto from 'crypto'

const hashNameMap = new Map()

function createHash(data: string, len: number, algorithm: string) {
  const hash = crypto.createHash(algorithm).update(data).digest('hex')
  return len !== 0 ? hash.substring(0, len) : hash
}

function existsHashName(name: string) {
  for (const hashName of hashNameMap.values()) {
    if (name === hashName) {
      return true
    }
  }
  return false
}

export default function createHashName(str: string, len = 5) {
  if (hashNameMap.has(str)) {
    return hashNameMap.get(str)
  }
  let hashName
  let i = 0
  do {
    hashName = createHash(`${str}${i++}`, len === 0 ? 0 : Math.max(+len || 0, 4), 'md5')
  } while (existsHashName(hashName))
  hashNameMap.set(str, hashName)
  return hashName
}
