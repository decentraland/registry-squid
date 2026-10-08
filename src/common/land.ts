const TWO_128 = 1n << 128n
const MASK_128 = TWO_128 - 1n
const INT128_MAX = (1n << 127n) - 1n

function toInt128(value: bigint): bigint {
  return value > INT128_MAX ? value - TWO_128 : value
}

/**
 * Decodes a LAND token id into its coordinates the way LANDRegistry.decodeTokenId does: the high
 * 128 bits are x and the low 128 bits are y, each a two's-complement signed integer. Doing it here
 * instead of calling the contract keeps the squid free of RPC.
 */
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
