export type Entity = { id: string }
export type EntityClass<E extends Entity> = new (props?: Partial<E>) => E

export interface Loader {
  get<E extends Entity>(entity: EntityClass<E>, id: string): Promise<E | undefined>
}

/**
 * Entities loaded on demand and cached for one batch, for modules whose event volume is small
 * enough that prefetching buys nothing. `save` marks an entity to be written at the end of the
 * batch; reading one does not. Misses are cached too: every write in the batch goes through `save`,
 * so an id that was missing stays missing until it is saved.
 */
export class LazyState {
  private readonly cache = new Map<EntityClass<any>, Map<string, Entity | undefined>>()
  readonly touched = new Map<EntityClass<any>, Set<string>>()
  readonly errors: string[] = []

  constructor(private readonly loader: Loader) {}

  async get<E extends Entity>(cls: EntityClass<E>, id: string): Promise<E | undefined> {
    let byId = this.cache.get(cls)
    if (!byId) this.cache.set(cls, (byId = new Map()))
    if (byId.has(id)) return byId.get(id) as E | undefined
    const found = await this.loader.get(cls, id)
    byId.set(id, found)
    return found
  }

  save<E extends Entity>(cls: EntityClass<E>, entity: E): void {
    let byId = this.cache.get(cls)
    if (!byId) this.cache.set(cls, (byId = new Map()))
    byId.set(entity.id, entity)
    let ids = this.touched.get(cls)
    if (!ids) this.touched.set(cls, (ids = new Set()))
    ids.add(entity.id)
  }

  entitiesToSave<E extends Entity>(cls: EntityClass<E>): E[] {
    const ids = this.touched.get(cls)
    const byId = this.cache.get(cls)
    if (!ids || !byId) return []
    return [...ids].map((id) => byId.get(id) as E)
  }
}
