import { In } from 'typeorm'
import { Store } from '@subsquid/typeorm-store'
import { AuthorizationState, Data, Estate, Parcel, Wallet } from '../../model'
import { estateId, parcelId } from '../../common/land'
import { LandEvent } from './events'
import { LandState } from './state'

// Keeps every IN (...) list well below Postgres' 65,535 bind parameters.
const CHUNK = 10_000

async function findByIds<E extends { id: string }>(
  store: Store,
  entity: new (props?: Partial<E>) => E,
  ids: Set<string>
): Promise<E[]> {
  const all = [...ids]
  const found: E[] = []
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK)
    found.push(...(await store.findBy(entity as any, { id: In(chunk) } as any)) as E[])
  }
  return found
}

/** Loads every entity the batch's events can read, so handlers run in memory. */
export async function loadLandState(store: Store, events: LandEvent[], estateRegistry: string): Promise<LandState> {
  const state = new LandState(estateRegistry)
  const parcels = new Set<string>()
  const estates = new Set<string>()
  const wallets = new Set<string>([estateRegistry])
  const datas = new Set<string>()
  const authorizationStates = new Set<string>()

  for (const ev of events) {
    switch (ev.kind) {
      case 'ParcelTransfer':
        parcels.add(parcelId(ev.tokenId))
        wallets.add(ev.to)
        break
      case 'ParcelApproval':
        parcels.add(parcelId(ev.tokenId))
        wallets.add(ev.owner)
        break
      case 'ParcelUpdateOperator':
        parcels.add(parcelId(ev.tokenId))
        break
      case 'ParcelUpdate':
        parcels.add(parcelId(ev.tokenId))
        datas.add(parcelId(ev.tokenId))
        break
      case 'Authorization':
        wallets.add(ev.owner)
        authorizationStates.add(`${ev.address}-${ev.owner}-${ev.operator}-${ev.type}`)
        break
      case 'EstateTransfer':
        estates.add(estateId(ev.tokenId))
        wallets.add(ev.to)
        break
      case 'EstateApproval':
        estates.add(estateId(ev.tokenId))
        wallets.add(ev.owner)
        break
      case 'EstateUpdateOperator':
        estates.add(estateId(ev.tokenId))
        break
      case 'EstateUpdate':
        estates.add(estateId(ev.tokenId))
        datas.add(estateId(ev.tokenId))
        break
      case 'CreateEstate':
        estates.add(estateId(ev.tokenId))
        datas.add(estateId(ev.tokenId))
        wallets.add(ev.owner)
        break
      case 'AddLand':
        estates.add(estateId(ev.estateTokenId))
        parcels.add(parcelId(ev.landTokenId))
        break
      case 'RemoveLand':
        estates.add(estateId(ev.estateTokenId))
        parcels.add(parcelId(ev.landTokenId))
        wallets.add(ev.destinatary)
        break
    }
  }

  for (const p of await findByIds(store, Parcel, parcels)) state.parcels.set(p.id, p)
  for (const e of await findByIds(store, Estate, estates)) state.estates.set(e.id, e)
  for (const w of await findByIds(store, Wallet, wallets)) state.wallets.set(w.id, w)
  for (const d of await findByIds(store, Data, datas)) state.datas.set(d.id, d)
  for (const a of await findByIds(store, AuthorizationState, authorizationStates)) state.authorizationStates.set(a.id, a)
  return state
}

function pick<E>(map: Map<string, E>, ids: Set<string>): E[] {
  return [...ids].map((id) => map.get(id)!).filter(Boolean)
}

/** Writes in foreign-key order: wallets and data, then estates, then parcels, then the logs. */
export async function saveLandState(store: Store, state: LandState): Promise<void> {
  await store.upsert(pick(state.wallets, state.newWallets))
  await store.upsert(pick(state.datas, state.touchedDatas))
  await store.upsert(pick(state.estates, state.touchedEstates))
  await store.upsert(pick(state.parcels, state.touchedParcels))
  await store.insert(state.owners)
  await store.insert(state.operators)
  await store.insert(state.updateOperators)
  await store.insert(state.estateHistories)
  await store.insert(state.authorizations)
  await store.upsert(pick(state.authorizationStates, state.touchedAuthorizationStates))
}
