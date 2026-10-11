// Text sorts and compares byte by byte, as in graph-node, whose databases use the C collation.
//
// This database sorts text by its default collation (en_US.UTF-8), which ignores punctuation and
// case on a first pass: "lacollectione-5b38" comes before "la-testera-108c", graph-node puts it
// after. A query reads `orderBy: id` by default, so with `first` it would get a different page than
// the subgraph's, and `id_gt` would page through a different order; the same goes for any text a
// query orders or ranges over, like `orderBy: searchName`. Every text column takes the C collation,
// keeping its type, so ordering and comparisons match. Equality is the same under both.
//
// It runs before the views, which read these columns: a column a view reads cannot change type.
//
// The generated models declare no collation, so `npm run migration:generate` against a migrated
// database reads every text column as changed and writes `COLLATE "undefined"` for each: generate
// against an empty database, or drop those lines. A regenerated table migration creates its tables
// without the C collation: keep this file after it, or set the collation there.
const TEXT_COLUMNS = `
  SELECT col.table_name, col.column_name, col.data_type FROM information_schema.columns col
    JOIN information_schema.tables tab ON tab.table_schema = col.table_schema AND tab.table_name = col.table_name
   WHERE col.table_schema = current_schema()
     AND tab.table_type = 'BASE TABLE'
     AND col.data_type IN ('character varying', 'text')`

const setCollation = (collation) => `
  DO $$
  DECLARE c record;
  BEGIN
    FOR c IN ${TEXT_COLUMNS} LOOP
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE %s COLLATE ${collation}', c.table_name, c.column_name, c.data_type);
    END LOOP;
  END $$`

module.exports = class TextCollation1791465864100 {
    name = 'TextCollation1791465864100'

    async up(db) {
        await db.query(setCollation('"C"'))
    }

    async down(db) {
        await db.query(setCollation('"default"'))
    }
}
