import { supabaseAdmin } from '../supabaseAdmin';

export type ListingCard = {
  id: string;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  rate_type: string | null;
  rate_amount: number | null;
  min_duration: number | null;
  max_duration: number | null;
  image: string | null;
};

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

const LISTING_ALLOWLIST_SELECT =
  'id, title, address, city, state, property_type, rate_type, rate_amount, min_duration, max_duration, status, created_at';

function coerceString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function fetchFirstImages(listingIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!listingIds.length) return map;
  // `listings_images` is used in frontend; migration not present in repo, so treat as optional.
  const { data, error } = await supabaseAdmin
    .from('listings_images')
    .select('property_id, image_url')
    .in('property_id', listingIds);

  if (error || !data) return map;

  for (const row of data as any[]) {
    const pid = row?.property_id;
    const urls = row?.image_url;
    if (typeof pid === 'string' && Array.isArray(urls) && typeof urls[0] === 'string' && urls[0]) {
      if (!map.has(pid)) map.set(pid, urls[0]);
    }
  }
  return map;
}

export async function tool_searchListings(args: unknown): Promise<ToolResult> {
  const a = (args || {}) as Record<string, unknown>;
  const city = coerceString(a.city);
  const state = coerceString(a.state);
  const propertyType = coerceString(a.propertyType);
  const rateType = coerceString(a.rateType);
  const q = coerceString(a.q);
  const minRate = coerceNumber(a.minRate);
  const maxRate = coerceNumber(a.maxRate);
  const limit = Math.min(Math.max(Math.trunc(coerceNumber(a.limit) ?? 8), 1), 20);

  let query = supabaseAdmin.from('listings').select(LISTING_ALLOWLIST_SELECT).eq('status', 'Available');

  if (city) query = query.eq('city', city);
  if (state) query = query.eq('state', state);
  if (propertyType) query = query.eq('property_type', propertyType);
  if (rateType) query = query.eq('rate_type', rateType);
  if (minRate != null) query = query.gte('rate_amount', minRate);
  if (maxRate != null) query = query.lte('rate_amount', maxRate);
  if (q) {
    // Search across a few text fields with OR. Keep it simple to avoid heavy queries.
    query = query.or(
      [`title.ilike.%${q}%`, `address.ilike.%${q}%`, `city.ilike.%${q}%`, `property_type.ilike.%${q}%`].join(',')
    );
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) return { ok: false, error: 'Failed to search listings' };

  const rows = (data ?? []) as any[];
  const ids = rows.map((r) => r.id).filter((id): id is string => typeof id === 'string');
  const imageMap = await fetchFirstImages(ids);

  const cards: ListingCard[] = rows.map((r) => ({
    id: r.id,
    title: r.title ?? null,
    address: r.address ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    property_type: r.property_type ?? null,
    rate_type: r.rate_type ?? null,
    rate_amount: r.rate_amount ?? null,
    min_duration: r.min_duration ?? null,
    max_duration: r.max_duration ?? null,
    image: imageMap.get(r.id) ?? null,
  }));

  return { ok: true, data: { listings: cards } };
}

export async function tool_getListing(args: unknown): Promise<ToolResult> {
  const a = (args || {}) as Record<string, unknown>;
  const listingId = coerceString(a.listingId);
  if (!listingId) return { ok: false, error: 'listingId is required' };

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(LISTING_ALLOWLIST_SELECT)
    .eq('id', listingId)
    .maybeSingle();
  if (error) return { ok: false, error: 'Failed to load listing' };
  if (!data) return { ok: false, error: 'Listing not found' };

  const imageMap = await fetchFirstImages([listingId]);
  const r: any = data;
  const listing: ListingCard = {
    id: r.id,
    title: r.title ?? null,
    address: r.address ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    property_type: r.property_type ?? null,
    rate_type: r.rate_type ?? null,
    rate_amount: r.rate_amount ?? null,
    min_duration: r.min_duration ?? null,
    max_duration: r.max_duration ?? null,
    image: imageMap.get(listingId) ?? null,
  };

  return { ok: true, data: { listing } };
}

export async function tool_checkAvailability(args: unknown): Promise<ToolResult> {
  const a = (args || {}) as Record<string, unknown>;
  const listingId = coerceString(a.listingId);
  const start = coerceString(a.start);
  const end = coerceString(a.end);
  if (!listingId || !start || !end) return { ok: false, error: 'listingId, start, end are required' };

  const startDt = new Date(start);
  const endDt = new Date(end);
  if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime()) || endDt <= startDt) {
    return { ok: false, error: 'Invalid start/end datetime window' };
  }

  // Same blocking statuses used in buy-now flow in backend/src/routes/bookings.ts
  const blockingStatuses = ['pending_payment', 'reserved', 'active'];
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, start_datetime, end_datetime, status')
    .eq('listing_id', listingId)
    .in('status', blockingStatuses);
  if (error) return { ok: false, error: 'Failed to load bookings' };

  const conflicts = (data ?? []).filter((b: any) => {
    const s = new Date(b.start_datetime);
    const e = new Date(b.end_datetime);
    return startDt < e && endDt > s;
  });

  return {
    ok: true,
    data: {
      available: conflicts.length === 0,
      conflicts: conflicts.map((c: any) => ({
        booking_id: c.id,
        start: c.start_datetime,
        end: c.end_datetime,
        status: c.status,
      })),
    },
  };
}

