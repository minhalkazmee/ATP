// Atomic round-robin assignment backed by Supabase.
// Uses a single-row table `round_robin_state` with an `current_index` column.
// Each call atomically reads the current index and advances it for the next caller.

import { SALES_TEAM, type SalesRep } from './_sales-team';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const headers = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'apikey':        SUPABASE_KEY,
};

/**
 * Returns the next sales rep in the round-robin rotation.
 * The counter is persisted in Supabase so it survives serverless cold starts.
 *
 * For NEW leads only — existing leads keep their current Zoho owner.
 */
export async function getNextSalesRep(): Promise<SalesRep> {
  const teamSize = SALES_TEAM.length;

  // 1. Read current index
  const getResp = await fetch(
    `${SUPABASE_URL}/rest/v1/round_robin_state?id=eq.default&select=current_index`,
    { headers },
  );

  let currentIndex = 0;

  if (getResp.ok) {
    const rows = await getResp.json();
    if (rows.length > 0) {
      currentIndex = rows[0].current_index ?? 0;
    } else {
      // First-ever call — seed the row
      await fetch(`${SUPABASE_URL}/rest/v1/round_robin_state`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ id: 'default', current_index: 0 }),
      });
    }
  }

  // 2. Pick the rep at current index (wrap around if team size changed)
  const idx = currentIndex % teamSize;
  const rep = SALES_TEAM[idx];

  // 3. Advance the counter for the next caller
  const nextIndex = (currentIndex + 1) % teamSize;
  await fetch(
    `${SUPABASE_URL}/rest/v1/round_robin_state?id=eq.default`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ current_index: nextIndex }),
    },
  );

  console.log(`[round-robin] Assigned index ${idx} → ${rep.name} (next: ${nextIndex})`);
  return rep;
}
