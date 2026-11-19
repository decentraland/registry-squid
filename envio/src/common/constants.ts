// Ethereum mainnet addresses and blocks, as in the squid's src/ethereum/config.ts.
export const ESTATE_REGISTRY = '0x959e104e1a4db6317fa58f8295f586e1a978c297'
export const LAND_REGISTRY = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d'
export const RENTALS_START_BLOCK = 16070889
/**
 * The mainnet LAND subgraph stores an empty metadata field as "" (Sepolia's reads it as null).
 * This port indexes mainnet only, so it is false; see the squid's `emptyMetadataReadsNull`.
 */
export const EMPTY_METADATA_READS_NULL = false
