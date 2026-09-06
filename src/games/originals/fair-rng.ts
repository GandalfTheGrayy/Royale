const encoder = new TextEncoder()

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToHex(new Uint8Array(digest))
}

export async function hmacBytes(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
}

export async function randomUnitStream(key: string, message: string, count: number) {
  const values: number[] = []
  let counter = 0
  while (values.length < count) {
    const bytes = await hmacBytes(key, `${message}:${counter}`)
    for (let offset = 0; offset + 3 < bytes.length && values.length < count; offset += 4) {
      const integer = (
        ((bytes[offset] << 24) >>> 0)
        + (bytes[offset + 1] << 16)
        + (bytes[offset + 2] << 8)
        + bytes[offset + 3]
      ) >>> 0
      values.push(integer / 0x1_0000_0000)
    }
    counter += 1
  }
  return values
}

export function secureSeed() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function shuffledRange(
  length: number,
  key: string,
  message: string,
  start = 0,
) {
  const result = Array.from({ length }, (_, index) => start + index)
  const randoms = await randomUnitStream(key, message, Math.max(1, length - 1))
  let randomIndex = 0
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randoms[randomIndex] * (index + 1))
    randomIndex += 1
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
