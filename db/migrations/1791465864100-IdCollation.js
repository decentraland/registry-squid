// Ids sort and compare byte by byte, as in graph-node, whose databases use the C collation.
//
// Ids are text, and this database sorts text by its default collation (en_US.UTF-8), which ignores
// punctuation on a first pass: "lacollectione-5b38" comes before "la-testera-108c", graph-node puts
// it after. A query reads `orderBy: id` by default, so with `first` it would get a different page
// than the subgraph's, and `id_gt` would page through a different order. Every id column, and every
// column holding one (`*_id`), takes the C collation, so ordering and comparisons match.
//
// It runs before the views, which read these columns: a column a view reads cannot change type. A
// regenerated table migration would create its tables without it: keep this file after it, or set
// the collation there.
const ID_COLUMNS = `
  SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND data_type IN ('character varying', 'text')
     AND (column_name = 'id' OR column_name LIKE '%\\_id')`

const setCollation = (collation) => `
  DO $$
  DECLARE c record;
  BEGIN
    FOR c IN ${ID_COLUMNS} LOOP
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE %s COLLATE ${collation}', c.table_name, c.column_name, c.data_type);
    END LOOP;
  END $$`

module.exports = class IdCollation1791465864100 {
    name = 'IdCollation1791465864100'

    async up(db) {
        await db.query(setCollation('"C"'))
    }

    async down(db) {
        await db.query(setCollation('"default"'))
    }
}
