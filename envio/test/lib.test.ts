// The squid's own unit tests for the shared helpers (src/common/*.test.ts), run against the copies.
import { describe, it, expect } from 'vitest'
import { decodeTokenId, encodeTokenId, estateId, parcelId, parseCSV, parseLandData } from '../src/common/land.js'

const SAMPLES: Array<{ id: string; x: bigint; y: bigint }> = [
  { id: '0x1', x: 0n, y: 1n },
  { id: '0xfffffffffffffffffffffffffffffffbfffffffffffffffffffffffffffffff6', x: -5n, y: -10n },
  { id: '0xffffffffffffffffffffffffffffffe700000000000000000000000000000075', x: -25n, y: 117n },
  { id: '0x5000000000000000000000000000000045', x: 80n, y: 69n },
]

describe('LAND ids', () => {
  it('match the subgraph', () => {
    for (const { id, x, y } of SAMPLES) {
      expect(parcelId(encodeTokenId(x, y))).toBe(id)
      expect(decodeTokenId(BigInt(id))).toEqual({ x, y })
    }
    expect(estateId(6516n)).toBe('6516')
  })
})

describe('parseCSV / parseLandData', () => {
  it('keeps graph-ts quirks', () => {
    expect(parseCSV('0,name')).toEqual(['0'])
    expect(parseCSV('0,name,')).toEqual(['0', 'name'])
    expect(parseCSV('0,"",""')).toEqual(['0', '', ''])
    expect(parseCSV('0,"a, b","desc"')).toEqual(['0', 'a, b', 'desc'])
    expect(parseCSV('0,,x,')).toEqual(['0', 'x'])
  })
  it('parses version 0 only, and strips NUL', () => {
    expect(parseLandData('1,"name"')).toBeNull()
    expect(parseLandData('0')).toBeNull()
    expect(parseLandData('0,"Genesis Plaza","",""')).toEqual({ version: '0', name: 'Genesis Plaza', description: '', ipns: '' })
    expect(parseLandData('0,"only a name"')).toEqual({ version: '0', name: 'only a name' })
    expect(parseLandData('0,"na\u0000me"')).toEqual({ version: '0', name: 'name' })
  })
})
