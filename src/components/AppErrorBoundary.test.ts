import { describe, expect, it } from 'vitest'
import { isRecoverableChunkLoadError } from './AppErrorBoundary'

describe('isRecoverableChunkLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: /assets/SlotWorld-old.js'),
    new Error('Importing a module script failed.'),
    Object.assign(new Error('Loading chunk 42 failed'), { name: 'ChunkLoadError' }),
  ])('recognizes an obsolete deployment chunk', (error) => {
    expect(isRecoverableChunkLoadError(error)).toBe(true)
  })

  it('does not reload for ordinary application errors', () => {
    expect(isRecoverableChunkLoadError(new Error('Invalid roulette bet'))).toBe(false)
  })
})
