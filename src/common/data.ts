import { parseCSV } from './csv'

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
 * Parses the metadata string of a LAND or Estate `Update` / `CreateEstate` event the way the
 * subgraph's `buildData` does. Only version "0" is understood; anything else yields null and leaves
 * the stored data untouched. Fields are only present when the CSV has them, because the subgraph
 * merges a partial save into the stored entity: a missing field keeps its previous value.
 */
export function parseLandData(csv: string): LandData | null {
  if (csv.charAt(0) !== '0') return null

  const values = parseCSV(csv)
  if (values.length === 0 || values[0] !== '0') return null

  const data: LandData = { version: sanitize(values[0]) }
  if (values.length > 1) data.name = sanitize(values[1])
  if (values.length > 2) data.description = sanitize(values[2])
  if (values.length > 3) data.ipns = sanitize(values[3])
  return data
}
