/** Sort all matches before pagination; keep unknown values last in either direction. */
export function sortInventory<T>(rows: T[], sort: { key: keyof T; direction: "asc" | "desc" } | null): T[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    const leftValid = typeof left === "number" && Number.isFinite(left);
    const rightValid = typeof right === "number" && Number.isFinite(right);
    if (!leftValid) return rightValid ? 1 : 0;
    if (!rightValid) return -1;
    return (left - right) * (sort.direction === "asc" ? 1 : -1);
  });
}
