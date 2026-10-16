/**
 * Build a Postgres `to_tsquery('simple', …)` string with prefix matching from
 * free user input. Only letters and digits survive, so the result can never
 * contain tsquery operators supplied by the user.
 */
export function buildPrefixTsQuery(input: string): string | null {
  const terms = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  if (terms.length === 0) return null;
  return terms.map((t) => `${t}:*`).join(" & ");
}
