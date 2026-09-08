/** Accept only structured, published handbook offering records. Unrecognised data is unknown. */
export const offeredPeriodsFrom = (value: unknown, handbookYear: number): string[] | undefined => {
  if (!Array.isArray(value) || !value.length) return undefined;
  const records: { teaching_period: string; offered: boolean | string; publish: boolean | string; year?: string | number }[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || typeof row.teaching_period !== "string" || !row.teaching_period.trim()
      || ![true, false, "true", "false"].includes(row.offered) || ![true, false, "true", "false"].includes(row.publish)) return undefined;
    records.push(row);
  }
  const current = records.filter((row) => !row.year || String(row.year) === String(handbookYear));
  const published = current.filter((row) => row.publish === true || row.publish === "true");
  if (!published.length) return undefined;
  return [...new Set(published.filter((row) => row.offered === true || row.offered === "true")
    .map((row) => row.teaching_period.trim()))];
};
