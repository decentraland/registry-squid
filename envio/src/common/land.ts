// Pure helpers, copied from the squid (../../../src/common/land.ts, csv.ts, data.ts) so this
// project stands alone. Behaviour is unchanged; see the originals for the reasoning.

const TWO_128 = 1n << 128n
const MASK_128 = TWO_128 - 1n
const INT128_MAX = (1n << 127n) - 1n

function toInt128(value: bigint): bigint {
  return value > INT128_MAX ? value - TWO_128 : value
}

/** LANDRegistry.decodeTokenId: high 128 bits are x, low 128 bits are y, both signed. */
export function decodeTokenId(tokenId: bigint): { x: bigint; y: bigint } {
  return { x: toInt128(tokenId >> 128n), y: toInt128(tokenId & MASK_128) }
}

export function encodeTokenId(x: bigint, y: bigint): bigint {
  const ux = x < 0n ? x + TWO_128 : x
  const uy = y < 0n ? y + TWO_128 : y
  return (ux << 128n) | uy
}

/** Parcel ids are the minimal lowercase hex of the token id, as graph-ts `BigInt.toHex()` prints it. */
export function parcelId(tokenId: bigint): string {
  return '0x' + tokenId.toString(16)
}

/** Estate ids are the decimal token id. */
export function estateId(tokenId: bigint): string {
  return tokenId.toString()
}

const enum CSVState {
  BETWEEN,
  UNQUOTED_VALUE,
  QUOTED_VALUE,
}

/**
 * A character-for-character port of graph-ts `parseCSV`, quirks included: a trailing unquoted
 * value is dropped, a quoted value ends at the next quote, consecutive commas emit nothing.
 */
export function parseCSV(csv: string): string[] {
  const values: string[] = []
  let valueStart = 0
  let state = CSVState.BETWEEN
  for (let i = 0; i < csv.length; i++) {
    const char = csv.charAt(i)
    if (state === CSVState.BETWEEN) {
      if (char !== ',') {
        if (char === '"') {
          state = CSVState.QUOTED_VALUE
          valueStart = i + 1
        } else {
          state = CSVState.UNQUOTED_VALUE
          valueStart = i
        }
      }
    } else if (state === CSVState.UNQUOTED_VALUE) {
      if (char === ',') {
        values.push(csv.substring(valueStart, i))
        state = CSVState.BETWEEN
      }
    } else if (state === CSVState.QUOTED_VALUE && char === '"') {
      values.push(csv.substring(valueStart, i))
      state = CSVState.BETWEEN
    }
  }
  return values
}

export interface LandData {
  version: string
  name?: string
  description?: string
  ipns?: string
}

/** Postgres text cannot hold NUL characters; strip them before persisting. */
export function sanitize(value: string): string {
  return value.replace(/\u0000/g, '')
}

/**
 * Parses LAND / Estate metadata as the subgraph's `buildData` does. Only version "0" is
 * understood; fields are present only when the CSV has them, so a merge keeps old values.
 */
export function parseLandData(csv: string): LandData | null {
  if (csv.charAt(0) !== '0') return null
  const values = parseCSV(csv)
  if (values.length === 0 || values[0] !== '0') return null
  const data: LandData = { version: sanitize(values[0]!) }
  if (values.length > 1) data.name = sanitize(values[1]!)
  if (values.length > 2) data.description = sanitize(values[2]!)
  if (values.length > 3) data.ipns = sanitize(values[3]!)
  return data
}
