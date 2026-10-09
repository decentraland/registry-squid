// Lookups of a rental by its signature, through a hash index rather than a btree.
//
// The signature is bytes the lessor controls: the Rentals contract checks it with ERC-1271 for a
// contract signer, so it can be any length. A btree index stores the value itself, and one over
// ~2.7 KB exceeds Postgres' maximum btree row size: the rental's upsert would fail, the batch retry
// forever, and the processor stall, rentals and LAND permissions with it. A hash index stores only
// a hash of the value and serves the same equality lookups (`signature` and `signature_in`).
//
// The schema cannot declare a hash index, so it lives here. A regenerated migration would not know
// about it: keep this file, or recreate the index, when the table migration is regenerated.
module.exports = class RentalSignatureHash1791465864101 {
    name = 'RentalSignatureHash1791465864101'

    async up(db) {
        await db.query(`CREATE INDEX "idx_rental_signature_hash" ON "rental" USING hash ("signature")`)
    }

    async down(db) {
        await db.query(`DROP INDEX "idx_rental_signature_hash"`)
    }
}
