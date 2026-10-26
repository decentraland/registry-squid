// The vesting contracts: Vesting, ReleaseLog and PausedLog (schema/vesting.graphql).
//
// Written from `npm run migration:generate`, keeping only these tables: against a migrated database
// the generator also undoes the C collation and the rental signature's hash index, which earlier
// migrations add by hand. Their text columns take the C collation here, as TextCollation gives every
// other table, so ids sort byte by byte as on the subgraph.
module.exports = class Vestings1792837192456 {
    name = 'Vestings1792837192456'

    async up(db) {
        await db.query(`CREATE TABLE "vesting" ("id" character varying COLLATE "C" NOT NULL, "version" integer NOT NULL, "duration" numeric NOT NULL, "cliff" numeric NOT NULL, "beneficiary" bytea NOT NULL, "revoked" boolean NOT NULL, "revocable" boolean NOT NULL, "released" numeric NOT NULL, "start" numeric NOT NULL, "period_duration" numeric NOT NULL, "vested_per_period" text[] COLLATE "C" NOT NULL, "paused" boolean NOT NULL, "pausable" boolean NOT NULL, "stop" numeric NOT NULL, "linear" boolean NOT NULL, "token" bytea NOT NULL, "owner" bytea NOT NULL, "total" numeric NOT NULL, "revoke_timestamp" numeric, CONSTRAINT "PK_35d441f205bf5bffdd2af4ca66f" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "release_log" ("id" character varying COLLATE "C" NOT NULL, "timestamp" numeric NOT NULL, "amount" numeric NOT NULL, "vesting_id" character varying COLLATE "C", CONSTRAINT "PK_559827caae00b096b6a1e0351f5" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "idx_release_log_vesting_2f02524e" ON "release_log" ("vesting_id") `)
        await db.query(`CREATE TABLE "paused_log" ("id" character varying COLLATE "C" NOT NULL, "timestamp" numeric NOT NULL, "event_type" text COLLATE "C" NOT NULL, "vesting_id" character varying COLLATE "C", CONSTRAINT "PK_0a41c39df4a41275d36c8d57c9b" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "idx_paused_log_vesting_3cd287fd" ON "paused_log" ("vesting_id") `)
        await db.query(`ALTER TABLE "release_log" ADD CONSTRAINT "FK_edb88ff1e546cb1c2f93193650d" FOREIGN KEY ("vesting_id") REFERENCES "vesting"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "paused_log" ADD CONSTRAINT "FK_c374fb15a41a86fb1ae0664a454" FOREIGN KEY ("vesting_id") REFERENCES "vesting"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "paused_log" DROP CONSTRAINT "FK_c374fb15a41a86fb1ae0664a454"`)
        await db.query(`ALTER TABLE "release_log" DROP CONSTRAINT "FK_edb88ff1e546cb1c2f93193650d"`)
        await db.query(`DROP TABLE "paused_log"`)
        await db.query(`DROP TABLE "release_log"`)
        await db.query(`DROP TABLE "vesting"`)
    }
}
