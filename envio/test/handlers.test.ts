import { describe, it, expect } from 'vitest'
import { createTestIndexer, TestHelpers } from 'envio'

const { Addresses } = TestHelpers
const LAND = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d'
const ESTATE = '0x959e104e1a4db6317fa58f8295f586e1a978c297'

describe('LAND and estates (simulated)', () => {
  it('a parcel added to an estate is owned by the estate registry and counted in its size', async () => {
    const indexer = createTestIndexer()
    const alice = Addresses.mockAddresses[0]!.toLowerCase() as `0x${string}`
    await indexer.process({
      chains: {
        1: {
          simulate: [
            { contract: 'LANDRegistry', event: 'Transfer', srcAddress: LAND, block: { number: 7_000_000, timestamp: 1_546_300_800 }, params: { from: Addresses.defaultAddress, to: alice, assetId: 5n } },
            { contract: 'EstateRegistry', event: 'Transfer', srcAddress: ESTATE, block: { number: 7_000_000, timestamp: 1_546_300_800 }, params: { _from: Addresses.defaultAddress, _to: alice, _tokenId: 7n } },
            { contract: 'EstateRegistry', event: 'CreateEstate', srcAddress: ESTATE, block: { number: 7_000_000, timestamp: 1_546_300_800 }, params: { _owner: alice, _estateId: 7n, _data: '0,"My estate","",' } },
            { contract: 'EstateRegistry', event: 'AddLand', srcAddress: ESTATE, block: { number: 7_000_000, timestamp: 1_546_300_800 }, params: { _estateId: 7n, _landId: 5n } },
          ],
        },
      },
    })
    const parcel = await indexer.Parcel.getOrThrow('0x5')
    expect(parcel.owner_id).toBe(ESTATE)
    expect(parcel.estate_id).toBe('7')
    expect(parcel.x).toBe(0n)
    expect(parcel.y).toBe(5n)
    const estate = await indexer.Estate.getOrThrow('7')
    expect(estate.size).toBe(1)
    expect(estate.owner_id).toBe(alice)
    const data = await indexer.Data.getOrThrow('7')
    // parseCSV drops the trailing unquoted value: name and description only.
    expect(data).toMatchObject({ version: '0', name: 'My estate', description: '', estate_id: '7' })
    expect((await indexer.EstateHistory.getAll()).map((h) => h.eventName)).toEqual(['AddLand'])
  })
})

describe('third-party registry (Polygon, real blocks)', () => {
  it('indexes the first third party as tpr-graph does', async () => {
    const indexer = createTestIndexer()
    // Step through the registry's first blocks with events until the first third party is added.
    let all = await indexer.ThirdParty.getAll()
    for (let i = 0; i < 20 && all.length === 0; i++) {
      await indexer.process({ chains: { 137: {} } })
      all = await indexer.ThirdParty.getAll()
    }
    const [tp] = all
    expect(tp).toBeDefined()
    expect(tp!.id.startsWith('urn:decentraland:')).toBe(true)
    expect(tp!.root).toBe('')
    expect((await indexer.ThirdPartyCount.getOrThrow('all')).thirdPartyTotal).toBe(1n)
  })
})

describe('vestings (Ethereum, real blocks and RPC)', () => {
  it('reads the first vesting the factory created after its start block', async () => {
    const indexer = createTestIndexer()
    await indexer.process({ chains: { 1: { startBlock: 12_732_618, endBlock: 12_732_618 } } })
    const vestings = await indexer.Vesting.getAll()
    expect(vestings).toHaveLength(1)
    const v = vestings[0]!
    expect([1, 2]).toContain(v.version)
    expect(v.token).toMatch(/^0x[0-9a-f]{40}$/)
  })
})
