import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeTokenId, encodeTokenId, estateId, parcelId } from './land'

// Ids and coordinates copied from the live land-manager subgraph.
const SAMPLES: Array<{ id: string; x: bigint; y: bigint }> = [
  { id: '0x1', x: 0n, y: 1n },
  { id: '0xfffffffffffffffffffffffffffffffbfffffffffffffffffffffffffffffff6', x: -5n, y: -10n },
  { id: '0xffffffffffffffffffffffffffffffe700000000000000000000000000000075', x: -25n, y: 117n },
  { id: '0x5000000000000000000000000000000045', x: 80n, y: 69n },
]

test('parcel ids and coordinates match the subgraph', () => {
  for (const { id, x, y } of SAMPLES) {
    const tokenId = encodeTokenId(x, y)
    assert.equal(parcelId(tokenId), id)
    assert.deepEqual(decodeTokenId(BigInt(id)), { x, y })
  }
})

test('a negative-coordinate token id round-trips through its decimal form', () => {
  const tokenId = BigInt('115792089237316195423570985008687907851908855197956810185604085578186056794102')
  assert.deepEqual(decodeTokenId(tokenId), { x: -5n, y: -10n })
})

test('estate ids are decimal', () => {
  assert.equal(estateId(6516n), '6516')
})
