import { Router, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse, PaginatedResponse } from '../types';

const router = Router();

type ContractorAvailabilityStatus = 'available' | 'soon' | 'busy';

interface ContractorRow {
  id: string;
  user_id: string;
  business_name: string;
  profile_picture_url: string | null;
  services: string[];
  hourly_rate: number;
  service_radius: number;
  rating: number;
  total_jobs_completed: number;
  is_verified: boolean;
  availability_status: ContractorAvailabilityStatus;
  available_days: string[];
}

interface ContractorApiModel {
  id: string;
  user_id: string;
  business_name: string;
  profile_picture_url: string | null;
  services: string[];
  hourly_rate: number;
  service_radius: number;
  rating: number;
  total_jobs_completed: number;
  /** Count of rows in public.reviews for this contractor's user_id (drives rating when > 0). */
  review_count: number;
  is_verified: boolean;
  availability: {
    status: ContractorAvailabilityStatus;
    available_days: string[];
  };
}

interface ReviewAggregate {
  avgRating: number;
  count: number;
}

async function fetchReviewAggregatesByTargetUserIds(
  userIds: string[],
): Promise<Map<string, ReviewAggregate>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, ReviewAggregate>();
  if (!unique.length) return map;

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('target_user_id, rating')
    .in('target_user_id', unique);

  if (error || !data?.length) {
    return map;
  }

  const sums = new Map<string, { sum: number; count: number }>();
  for (const row of data as { target_user_id: string; rating: number }[]) {
    const uid = row.target_user_id;
    const prev = sums.get(uid) ?? { sum: 0, count: 0 };
    prev.sum += Number(row.rating);
    prev.count += 1;
    sums.set(uid, prev);
  }

  for (const [uid, v] of sums) {
    const avgRating = v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0;
    map.set(uid, { avgRating, count: v.count });
  }
  return map;
}

function logContractorApi(
  method: string,
  path: string,
  userId?: string,
  success?: boolean,
  error?: string
) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

function mapRowToApiModel(
  row: ContractorRow,
  reviewAgg?: ReviewAggregate | null,
): ContractorApiModel {
  const hasReviews = Boolean(reviewAgg && reviewAgg.count > 0);
  const rating = hasReviews ? reviewAgg!.avgRating : row.rating;
  return {
    id: row.id,
    user_id: row.user_id,
    business_name: row.business_name,
    profile_picture_url: row.profile_picture_url,
    services: row.services,
    hourly_rate: row.hourly_rate,
    service_radius: row.service_radius,
    rating,
    total_jobs_completed: row.total_jobs_completed,
    review_count: hasReviews ? reviewAgg!.count : 0,
    is_verified: row.is_verified,
    availability: {
      status: row.availability_status,
      available_days: row.available_days,
    },
  };
}

async function requireContractorRole(userId: string, res: Response): Promise<boolean> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_contractor')
    .eq('id', userId)
    .single();
  if (error || !profile?.is_contractor) {
    res.status(403).json({
      success: false,
      error: 'Contractor role required. Enable the Contractor role on your profile first.',
    });
    return false;
  }
  return true;
}

/**
 * GET /api/contractors/me
 *
 * Returns the contractor profile for the authenticated user (if any).
 * Requires profiles.is_contractor = true.
 */
router.get<
  ParamsDictionary,
  ApiResponse<ContractorApiModel | undefined> | ApiResponse
>(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logContractorApi('GET', '/api/contractors/me', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    if (!(await requireContractorRole(userId, res))) {
      logContractorApi('GET', '/api/contractors/me', userId, false, 'Not contractor');
      return;
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('contractors')
      .select(
        'id, user_id, business_name, profile_picture_url, services, hourly_rate, service_radius, rating, total_jobs_completed, is_verified, availability_status, available_days'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logContractorApi('GET', '/api/contractors/me', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch contractor profile' });
      return;
    }

    if (!data) {
      logContractorApi('GET', '/api/contractors/me', userId, true);
      res.json({ success: true, data: undefined });
      return;
    }

    const aggMap = await fetchReviewAggregatesByTargetUserIds([data.user_id]);
    const contractor = mapRowToApiModel(data, aggMap.get(data.user_id));

    logContractorApi('GET', '/api/contractors/me', userId, true);
    res.json({ success: true, data: contractor });
  })
);

/**
 * GET /api/contractors/:id
 *
 * Returns a public contractor profile by contractor record ID.
 * This endpoint is used by profile pages and does not require auth.
 */
router.get<
  { id: string },
  ApiResponse<ContractorApiModel> | ApiResponse
>(
  '/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      logContractorApi('GET', '/api/contractors/:id', undefined, false, 'Missing contractor id');
      res.status(400).json({ success: false, error: 'Missing contractor id' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('contractors')
      .select(
        'id, user_id, business_name, profile_picture_url, services, hourly_rate, service_radius, rating, total_jobs_completed, is_verified, availability_status, available_days'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logContractorApi('GET', '/api/contractors/:id', undefined, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch contractor profile' });
      return;
    }

    if (!data) {
      logContractorApi('GET', '/api/contractors/:id', undefined, false, 'Not found');
      res.status(404).json({ success: false, error: 'Contractor not found' });
      return;
    }

    const aggMap = await fetchReviewAggregatesByTargetUserIds([data.user_id]);
    const contractor = mapRowToApiModel(data, aggMap.get(data.user_id));
    logContractorApi('GET', '/api/contractors/:id', undefined, true);
    res.json({ success: true, data: contractor });
  })
);

/**
 * POST /api/contractors/me
 *
 * Create or update the contractor profile for the authenticated user.
 */
router.post<
  ParamsDictionary,
  ApiResponse<ContractorApiModel> | ApiResponse,
  {
    business_name?: string;
    services?: string[];
    hourly_rate?: number;
    service_radius?: number;
    availability_status?: ContractorAvailabilityStatus;
    available_days?: string[];
    profile_picture_url?: string | null;
  }
>(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logContractorApi('POST', '/api/contractors/me', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    if (!(await requireContractorRole(userId, res))) {
      logContractorApi('POST', '/api/contractors/me', userId, false, 'Not contractor');
      return;
    }

    const {
      business_name,
      services,
      hourly_rate,
      service_radius,
      availability_status,
      available_days,
      profile_picture_url,
    } = req.body;

    if (!business_name || !business_name.trim()) {
      res.status(400).json({ success: false, error: 'business_name is required' });
      return;
    }

    if (!Array.isArray(services) || services.length === 0) {
      res.status(400).json({ success: false, error: 'services must be a non-empty array of strings' });
      return;
    }

    if (typeof hourly_rate !== 'number' || Number.isNaN(hourly_rate) || hourly_rate <= 0) {
      res.status(400).json({ success: false, error: 'hourly_rate must be a positive number' });
      return;
    }

    if (typeof service_radius !== 'number' || Number.isNaN(service_radius) || service_radius <= 0) {
      res.status(400).json({ success: false, error: 'service_radius must be a positive number' });
      return;
    }

    const status: ContractorAvailabilityStatus = availability_status || 'available';
    const days: string[] = Array.isArray(available_days) ? available_days : [];

    const upsertPayload: Partial<ContractorRow> & {
      user_id: string;
      business_name: string;
      services: string[];
      hourly_rate: number;
      service_radius: number;
      availability_status: ContractorAvailabilityStatus;
      available_days: string[];
    } = {
      user_id: userId,
      business_name: business_name.trim(),
      services,
      hourly_rate,
      service_radius,
      availability_status: status,
      available_days: days,
    };

    if (typeof profile_picture_url !== 'undefined') {
      upsertPayload.profile_picture_url = profile_picture_url;
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('contractors')
      .upsert(upsertPayload, {
        onConflict: 'user_id',
      })
      .select(
        'id, user_id, business_name, profile_picture_url, services, hourly_rate, service_radius, rating, total_jobs_completed, is_verified, availability_status, available_days'
      )
      .maybeSingle();

    if (error || !data) {
      logContractorApi('POST', '/api/contractors/me', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to save contractor profile' });
      return;
    }

    const aggMap = await fetchReviewAggregatesByTargetUserIds([data.user_id]);
    const contractor = mapRowToApiModel(data, aggMap.get(data.user_id));

    logContractorApi('POST', '/api/contractors/me', userId, true);
    res.status(201).json({ success: true, data: contractor });
  })
);

/**
 * GET /api/contractors
 *
 * Query params:
 * - search: string (matches business_name case-insensitively)
 * - service: string | string[] (comma-separated or repeated; filters by services overlap)
 * - available: 'true' | 'false' (when true, only availability_status = 'available')
 * - radius: number (miles; contractors whose service_radius >= radius)
 * - page: number (1-based, default 1)
 * - limit: number (default 12, max 50)
 *
 * Access control:
 * - Requires authenticated user with landlord role (profiles.is_landlord = true)
 */
router.get<
  ParamsDictionary,
  PaginatedResponse<ContractorApiModel> | ApiResponse
>(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logContractorApi('GET', '/api/contractors', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    // Ensure caller is a landlord
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('is_landlord')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      logContractorApi('GET', '/api/contractors', userId, false, profileError.message);
      res.status(500).json({ success: false, error: 'Failed to validate user role' });
      return;
    }

    if (!profile || !profile.is_landlord) {
      logContractorApi('GET', '/api/contractors', userId, false, 'Forbidden: not landlord');
      res.status(403).json({ success: false, error: 'Only landlords can browse contractors' });
      return;
    }

    const {
      search,
      service,
      available,
      radius,
      page = '1',
      limit = '12',
    } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const pageSizeRaw = parseInt(limit as string, 10) || 12;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 50);
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryBuilder = supabaseAdmin
      .from('contractors')
      .select(
        'id, user_id, business_name, profile_picture_url, services, hourly_rate, service_radius, rating, total_jobs_completed, is_verified, availability_status, available_days',
        { count: 'exact' }
      );

    // Filter by service(s)
    const rawService = service as string | string[] | undefined;
    if (rawService) {
      const servicesArray = Array.isArray(rawService)
        ? rawService
        : rawService.split(',').map((s) => s.trim());
      const services = servicesArray.filter(Boolean);
      if (services.length) {
        // overlaps: at least one of the requested services appears in contractor.services
        queryBuilder = queryBuilder.overlaps('services', services);
      }
    }

    // Filter by availability
    if (available === 'true') {
      queryBuilder = queryBuilder.eq('availability_status', 'available');
    }

    // Filter by radius (simple: contractor.service_radius >= requested radius)
    if (radius) {
      const radiusNum = parseInt(radius as string, 10);
      if (!Number.isNaN(radiusNum)) {
        queryBuilder = queryBuilder.gte('service_radius', radiusNum);
      }
    }

    // Search by business name (and optionally service text)
    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      queryBuilder = queryBuilder.ilike('business_name', term);
    }

    queryBuilder = queryBuilder
      .order('rating', { ascending: false })
      .order('total_jobs_completed', { ascending: false })
      .range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) {
      logContractorApi('GET', '/api/contractors', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch contractors' });
      return;
    }

    const rows: ContractorRow[] = data ?? [];
    const userIds = rows.map((r) => r.user_id);
    const aggMap = await fetchReviewAggregatesByTargetUserIds(userIds);

    const contractors: ContractorApiModel[] = rows
      .map((row) => mapRowToApiModel(row, aggMap.get(row.user_id)))
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.total_jobs_completed !== a.total_jobs_completed) {
          return b.total_jobs_completed - a.total_jobs_completed;
        }
        return a.business_name.localeCompare(b.business_name);
      });

    const total = count ?? 0;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;

    logContractorApi('GET', '/api/contractors', userId, true);

    res.json({
      success: true,
      data: contractors,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages,
      },
    });
  })
);

export default router;

