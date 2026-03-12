import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse, PaginatedResponse } from '../types';

const router = Router();

type ContractorJobStatus = 'requested' | 'accepted' | 'declined' | 'completed';

interface ContractorJobRow {
  id: string;
  landlord_id: string;
  contractor_id: string;
  listing_id: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  preferred_date: string | null;
  status: ContractorJobStatus;
  landlord_note: string | null;
  contractor_note: string | null;
  created_at: string;
  updated_at: string;
}

interface ContractorJobApiModel {
  id: string;
  landlord_id: string;
  contractor_id: string;
  listing_id: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  preferred_date: string | null;
  status: ContractorJobStatus;
  landlord_note: string | null;
  contractor_note: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToApiModel(row: ContractorJobRow): ContractorJobApiModel {
  return { ...row };
}

function logContractorJobs(
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

/**
 * POST /api/contractor-jobs
 *
 * Landlord creates a job request for a contractor.
 */
router.post<
  unknown,
  ApiResponse<ContractorJobApiModel> | ApiResponse,
  {
    contractor_id?: string;
    listing_id?: string | null;
    title?: string;
    description?: string;
    budget?: number | null;
    preferred_date?: string | null;
    landlord_note?: string | null;
  }
>(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logContractorJobs('POST', '/api/contractor-jobs', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      contractor_id,
      listing_id,
      title,
      description,
      budget,
      preferred_date,
      landlord_note,
    } = req.body;

    if (!contractor_id) {
      res.status(400).json({ success: false, error: 'contractor_id is required' });
      return;
    }
    if (!listing_id) {
      res.status(400).json({ success: false, error: 'listing_id is required' });
      return;
    }
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, error: 'title is required' });
      return;
    }

    const insertPayload: Partial<ContractorJobRow> & {
      landlord_id: string;
      contractor_id: string;
      title: string;
      listing_id: string;
    } = {
      landlord_id: userId,
      contractor_id,
      listing_id,
      title: title.trim(),
      description: description?.trim() || null,
      status: 'requested',
      landlord_note: landlord_note?.trim() || null,
    };
    if (typeof budget === 'number' && !Number.isNaN(budget)) {
      insertPayload.budget = budget;
    }
    if (preferred_date) {
      insertPayload.preferred_date = preferred_date;
    }

    const { data, error } = await supabaseAdmin
      .from<ContractorJobRow>('contractor_jobs')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      logContractorJobs('POST', '/api/contractor-jobs', userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to create contractor job' });
      return;
    }

    const job = mapRowToApiModel(data);
    logContractorJobs('POST', '/api/contractor-jobs', userId, true);
    res.status(201).json({ success: true, data: job });
  })
);

/**
 * GET /api/contractor-jobs
 *
 * Query params:
 * - role: 'landlord' | 'contractor' (defaults to 'landlord')
 * - page, limit
 * - listing_id: filter landlord view to a specific listing
 */
router.get<
  unknown,
  PaginatedResponse<ContractorJobApiModel> | ApiResponse
>(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logContractorJobs('GET', '/api/contractor-jobs', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const { role = 'landlord', page = '1', limit = '20', listing_id } = req.query;
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const pageSizeRaw = parseInt(limit as string, 10) || 20;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 50);
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from<ContractorJobRow>('contractor_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role === 'contractor') {
      query = query.eq('contractor_id', userId);
    } else {
      query = query.eq('landlord_id', userId);
      if (listing_id) {
        query = query.eq('listing_id', listing_id as string);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      logContractorJobs('GET', '/api/contractor-jobs', userId, false, error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch contractor jobs' });
      return;
    }

    const rows: ContractorJobRow[] = data ?? [];
    const jobs = rows.map(mapRowToApiModel);
    const total = count ?? 0;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;

    logContractorJobs('GET', '/api/contractor-jobs', userId, true);
    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages,
      },
    });
  })
);

/**
 * PATCH /api/contractor-jobs/:id
 *
 * Allows landlord or contractor to update status/notes on a job they own.
 */
router.patch<
  { id: string },
  ApiResponse<ContractorJobApiModel> | ApiResponse,
  {
    status?: ContractorJobStatus;
    landlord_note?: string | null;
    contractor_note?: string | null;
    preferred_date?: string | null;
  }
>(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);
    const { id } = req.params;

    if (!userId) {
      logContractorJobs('PATCH', `/api/contractor-jobs/${id}`, undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const {
      status,
      landlord_note,
      contractor_note,
      preferred_date,
    } = req.body;

    const updates: Partial<ContractorJobRow> = {};
    if (status) updates.status = status;
    if (typeof landlord_note !== 'undefined') {
      updates.landlord_note = landlord_note?.trim() || null;
    }
    if (typeof contractor_note !== 'undefined') {
      updates.contractor_note = contractor_note?.trim() || null;
    }
    if (typeof preferred_date !== 'undefined') {
      updates.preferred_date = preferred_date;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from<ContractorJobRow>('contractor_jobs')
      .select('landlord_id, contractor_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      logContractorJobs('PATCH', `/api/contractor-jobs/${id}`, userId, false, fetchError?.message || 'Not found');
      res.status(404).json({ success: false, error: 'Contractor job not found' });
      return;
    }

    if (existing.landlord_id !== userId && existing.contractor_id !== userId) {
      logContractorJobs('PATCH', `/api/contractor-jobs/${id}`, userId, false, 'Forbidden');
      res.status(403).json({ success: false, error: 'You do not have permission to update this job' });
      return;
    }

    updates.updated_at = new Date().toISOString() as any;

    const { data, error } = await supabaseAdmin
      .from<ContractorJobRow>('contractor_jobs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      logContractorJobs('PATCH', `/api/contractor-jobs/${id}`, userId, false, error?.message || 'Unknown error');
      res.status(500).json({ success: false, error: 'Failed to update contractor job' });
      return;
    }

    const job = mapRowToApiModel(data);
    logContractorJobs('PATCH', `/api/contractor-jobs/${id}`, userId, true);
    res.json({ success: true, data: job });
  })
);

export default router;

