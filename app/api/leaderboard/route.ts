import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

const FEATURE_TABLES = ['spaces', 'openings', 'vertical_connectors', 'amenities'] as const;

function getPeriodStart(period: string): string | null {
  const now = new Date();
  if (period === 'weekly') {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (period === 'monthly') {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null; // alltime
}

/**
 * GET /api/leaderboard?period=weekly|monthly|alltime
 * Returns a ranked list of users by total indoor features created.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'alltime';
  const periodStart = getPeriodStart(period);

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const countMap = new Map<string, number>();

  for (const table of FEATURE_TABLES) {
    let query = supabase
      .schema('indoor')
      .from(table)
      .select('created_by, created_at')
      .not('created_by', 'is', null)
      .neq('status', 'archived');

    if (periodStart) {
      query = query.gte('created_at', periodStart);
    }

    const { data, error } = await query;
    if (error || !data) continue;

    for (const row of data) {
      const uid = row.created_by as string;
      countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
    }
  }

  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  const userIds = sorted.map(([uid]) => uid);

  let profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    if (profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p.username ?? 'Anonymous']));
    }
  }

  const leaderboard = sorted.map(([uid, features], i) => ({
    rank: i + 1,
    userId: uid,
    name: profileMap.get(uid) ?? 'Anonymous',
    features,
  }));

  let currentUser = null;
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      const userFeatures = countMap.get(user.id) ?? 0;
      const userRank = sorted.findIndex(([uid]) => uid === user.id);
      currentUser = {
        rank: userRank >= 0 ? userRank + 1 : (sorted.length + 1),
        userId: user.id,
        name: profileMap.get(user.id) ?? 'You',
        features: userFeatures,
      };
    }
  } catch {
    // Not logged in
  }

  return NextResponse.json({ leaderboard, currentUser });
}
