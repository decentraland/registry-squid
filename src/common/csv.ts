const enum CSVState {
  BETWEEN,
  UNQUOTED_VALUE,
  QUOTED_VALUE,
}

/**
 * A character-for-character port of graph-ts `parseCSV`, which the subgraphs use to read LAND and
 * Estate metadata. Its quirks are kept on purpose, because they decide what the subgraph stored:
 * - an unquoted value is only emitted when a comma follows it, so a trailing unquoted value is
 *   dropped ("0,name" yields ["0"]);
 * - a quoted value ends at the next double quote, with no escaping;
 * - consecutive commas emit nothing, so empty unquoted fields disappear.
 */
export function parseCSV(csv: string): string[] {
  const values: string[] = []
  let valueStart = 0
  let state = CSVState.BETWEEN

  for (let i = 0; i < csv.length; i++) {
    const char = csv.charAt(i)
    if (state === CSVState.BETWEEN) {
      if (char !== ',') {
        if (char === '"') {
          state = CSVState.QUOTED_VALUE
          valueStart = i + 1
        } else {
          state = CSVState.UNQUOTED_VALUE
          valueStart = i
        }
      }
    } else if (state === CSVState.UNQUOTED_VALUE) {
      if (char === ',') {
        values.push(csv.substring(valueStart, i))
        state = CSVState.BETWEEN
      }
    } else if (state === CSVState.QUOTED_VALUE && char === '"') {
      values.push(csv.substring(valueStart, i))
      state = CSVState.BETWEEN
    }
  }

  return values
}
