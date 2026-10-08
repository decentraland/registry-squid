/** An optional block number from the environment; anything but a non-negative integer is an error. */
export function blockFromEnv(name: string): number | undefined {
  const value = process.env[name]
  if (!value) return undefined
  const block = Number(value)
  if (!Number.isSafeInteger(block) || block < 0) throw new Error(`${name} must be a block number, got "${value}"`)
  return block
}
