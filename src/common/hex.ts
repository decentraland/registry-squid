export function toBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  return Uint8Array.from(Buffer.from(clean, 'hex'))
}

export function toHex(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex')
}

export function lower(address: string): string {
  return address.toLowerCase()
}
