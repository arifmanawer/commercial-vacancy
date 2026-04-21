import { Router, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { computeOfferActionability } from '../lib/offerActionability';

const router = Router();

type ConversationContextType = 'listing' | 'contractor' | 'general';

interface ConversationRow {
  id: string;
  created_at: string;
  created_by: string;
  context_type: ConversationContextType;
  context_listing_id: string | null;
  context_contractor_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface ConversationParticipantRow {
  conversation_id: string;
  user_id: string;
  role: 'landlord' | 'renter' | 'contractor' | null;
  last_read_at: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ConversationSummary {
  id: string;
  context_type: ConversationContextType;
  context_listing_id: string | null;
  context_contractor_id: string | null;
  context_listing_title: string | null;
  context_listing_address: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  participants: {
    user_id: string;
    role: string | null;
  }[];
  unread_count: number;
}

interface ListingBasic {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface MessageApiModel {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface OfferActionabilityModel {
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
  canWithdraw: boolean;
  reasonIfDisabled: string | null;
}

function logMessagesApi(
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

function getUserId(req: Request): string | null {
  const headerId = req.headers['x-user-id'];
  const queryId = req.query.user_id;
  const id = (headerId as string) || (queryId as string) || '';
  return id || null;
}

async function fetchListingMap(listingIds: string[]): Promise<Map<string, ListingBasic>> {
  const map = new Map<string, ListingBasic>();
  const unique = [...new Set(listingIds.filter(Boolean))];
  if (!unique.length) return map;

  const { data } = await supabaseAdmin
    .from('listings')
    .select('id, title, address, city, state')
    .in('id', unique);

  for (const row of data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

function listingLabel(listing: ListingBasic | undefined): { title: string | null; address: string | null } {
  if (!listing) return { title: null, address: null };
  const parts = [listing.address, listing.city, listing.state].filter(Boolean);
  return {
    title: listing.title || null,
    address: parts.length ? parts.join(', ') : null,
  };
}

/**
 * GET /api/messages/conversations
 *
 * Returns all conversations for the authenticated user with unread counts.
 */
router.get<
  ParamsDictionary,
  ApiResponse<ConversationSummary[]> | ApiResponse
>(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);

    if (!userId) {
      logMessagesApi('GET', '/api/messages/conversations', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: participantRows, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, role, last_read_at')
      .eq('user_id', userId);

    if (participantsError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations',
        userId,
        false,
        participantsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load conversations' });
      return;
    }

    const conversationIds = (participantRows ?? []).map((p) => p.conversation_id);

    if (!conversationIds.length) {
      logMessagesApi('GET', '/api/messages/conversations', userId, true);
      res.json({ success: true, data: [] });
      return;
    }

    const { data: conversationRows, error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .select(
        'id, created_at, created_by, context_type, context_listing_id, context_contractor_id, last_message_at, last_message_preview'
      )
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (conversationsError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations',
        userId,
        false,
        conversationsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load conversations' });
      return;
    }

    const { data: allParticipants, error: allParticipantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, role, last_read_at')
      .in('conversation_id', conversationIds);

    if (allParticipantsError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations',
        userId,
        false,
        allParticipantsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load participants' });
      return;
    }

    const { data: latestMessages, error: latestMessagesError } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, created_at, sender_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    if (latestMessagesError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations',
        userId,
        false,
        latestMessagesError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load unread counts' });
      return;
    }

    const listingIds = (conversationRows ?? [])
      .map((c) => c.context_listing_id)
      .filter((id): id is string => !!id);
    const listingMap = await fetchListingMap(listingIds);

    const summaries: ConversationSummary[] = (conversationRows ?? []).map((conv) => {
      const participantsForConversation = (allParticipants ?? []).filter(
        (p) => p.conversation_id === conv.id
      );

      const selfParticipant = participantsForConversation.find((p) => p.user_id === userId);
      const selfLastRead = selfParticipant?.last_read_at
        ? new Date(selfParticipant.last_read_at).getTime()
        : 0;

      const unreadMessagesForConversation = (latestMessages ?? []).filter(
        (m) =>
          m.conversation_id === conv.id &&
          new Date(m.created_at).getTime() > selfLastRead &&
          m.sender_id !== userId
      );

      const listing = conv.context_listing_id ? listingMap.get(conv.context_listing_id) : undefined;
      const { title: lTitle, address: lAddr } = listingLabel(listing);

      return {
        id: conv.id,
        context_type: conv.context_type,
        context_listing_id: conv.context_listing_id,
        context_contractor_id: conv.context_contractor_id,
        context_listing_title: lTitle,
        context_listing_address: lAddr,
        last_message_at: conv.last_message_at,
        last_message_preview: conv.last_message_preview,
        participants: participantsForConversation.map((p) => ({
          user_id: p.user_id,
          role: p.role,
        })),
        unread_count: unreadMessagesForConversation.length,
      };
    });

    logMessagesApi('GET', '/api/messages/conversations', userId, true);
    res.json({ success: true, data: summaries });
  })
);

/**
 * POST /api/messages/conversations
 *
 * Creates or returns an existing conversation for a given context and participant set.
 */
router.post<
  ParamsDictionary,
  ApiResponse<ConversationSummary> | ApiResponse,
  {
    contextType: ConversationContextType;
    listingId?: string;
    contractorId?: string;
    participantIds: string[];
  }
>(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);

    if (!userId) {
      logMessagesApi('POST', '/api/messages/conversations', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { contextType, listingId, contractorId, participantIds } = req.body;

    if (!contextType || !['listing', 'contractor', 'general'].includes(contextType)) {
      res.status(400).json({ success: false, error: 'Invalid contextType' });
      return;
    }

    if (!Array.isArray(participantIds) || participantIds.length < 1) {
      res.status(400).json({
        success: false,
        error: 'participantIds must contain at least one other user ID',
      });
      return;
    }

    const normalizedParticipants = participantIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean);
    const participantSet = Array.from(new Set([...normalizedParticipants, userId])).sort();

    if (participantSet.length < 2) {
      res.status(400).json({
        success: false,
        error: 'You cannot start a conversation with only yourself',
      });
      return;
    }

    let convQuery = supabaseAdmin
      .from('conversations')
      .select(
        'id, created_at, created_by, context_type, context_listing_id, context_contractor_id, last_message_at, last_message_preview'
      )
      .eq('context_type', contextType);

    if (contextType === 'listing') {
      convQuery = convQuery.eq('context_listing_id', listingId as string).is('context_contractor_id', null);
    } else if (contextType === 'contractor') {
      convQuery = convQuery
        .eq('context_contractor_id', contractorId as string)
        .is('context_listing_id', null);
    } else {
      convQuery = convQuery.is('context_listing_id', null).is('context_contractor_id', null);
    }

    const { data: convCandidates, error: convCandidatesError } = await convQuery;

    if (convCandidatesError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations',
        userId,
        false,
        convCandidatesError.message
      );
      res.status(500).json({ success: false, error: 'Failed to find or create conversation' });
      return;
    }

    let conversation: ConversationRow | null = null;

    if (convCandidates && convCandidates.length > 0) {
      const candidateIds = convCandidates.map((c) => c.id);
      const { data: candidateParticipants, error: candidateParticipantsError } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', candidateIds);

      if (candidateParticipantsError) {
        logMessagesApi(
          'POST',
          '/api/messages/conversations',
          userId,
          false,
          candidateParticipantsError.message
        );
        res.status(500).json({ success: false, error: 'Failed to find or create conversation' });
        return;
      }

      for (const candidate of convCandidates) {
        const participantsForConversation = (candidateParticipants ?? []).filter(
          (p) => p.conversation_id === candidate.id
        );
        const ids = participantsForConversation.map((p) => p.user_id).sort();
        if (
          ids.length === participantSet.length &&
          ids.every((id, idx) => id === participantSet[idx])
        ) {
          conversation = candidate;
          break;
        }
      }
    }

    if (!conversation) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('conversations')
        .insert({
          created_by: userId,
          context_type: contextType,
          context_listing_id: listingId ?? null,
          context_contractor_id: contractorId ?? null,
        } as Partial<ConversationRow>)
        .select(
          'id, created_at, created_by, context_type, context_listing_id, context_contractor_id, last_message_at, last_message_preview'
        )
        .single();

      if (insertError || !inserted) {
        logMessagesApi(
          'POST',
          '/api/messages/conversations',
          userId,
          false,
          insertError?.message
        );
        res.status(500).json({ success: false, error: 'Failed to create conversation' });
        return;
      }

      conversation = inserted;
      const conversationId = conversation.id;

      const participantRowsToInsert: Partial<ConversationParticipantRow>[] = participantSet.map(
        (pid) => ({
          conversation_id: conversationId,
          user_id: pid,
        })
      );

      const { error: participantsInsertError } = await supabaseAdmin
        .from('conversation_participants')
        .insert(participantRowsToInsert);

      if (participantsInsertError) {
        logMessagesApi(
          'POST',
          '/api/messages/conversations',
          userId,
          false,
          participantsInsertError.message
        );
        res.status(500).json({ success: false, error: 'Failed to add participants' });
        return;
      }
    }

    if (!conversation) {
      res.status(500).json({ success: false, error: 'Failed to find or create conversation' });
      return;
    }

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, role, last_read_at')
      .eq('conversation_id', conversation.id);

    if (participantsError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations',
        userId,
        false,
        participantsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load participants' });
      return;
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, created_at, sender_id')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false });

    if (messagesError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations',
        userId,
        false,
        messagesError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load messages' });
      return;
    }

    const selfParticipant = (participants ?? []).find((p) => p.user_id === userId);
    const selfLastRead = selfParticipant?.last_read_at
      ? new Date(selfParticipant.last_read_at).getTime()
      : 0;

    const unreadMessages = (messages ?? []).filter(
      (m) =>
        new Date(m.created_at).getTime() > selfLastRead &&
        m.sender_id !== userId
    );

    const postListingMap = await fetchListingMap(
      conversation.context_listing_id ? [conversation.context_listing_id] : []
    );
    const postListing = conversation.context_listing_id
      ? postListingMap.get(conversation.context_listing_id)
      : undefined;
    const { title: postLTitle, address: postLAddr } = listingLabel(postListing);

    const summary: ConversationSummary = {
      id: conversation.id,
      context_type: conversation.context_type,
      context_listing_id: conversation.context_listing_id,
      context_contractor_id: conversation.context_contractor_id,
      context_listing_title: postLTitle,
      context_listing_address: postLAddr,
      last_message_at: conversation.last_message_at,
      last_message_preview: conversation.last_message_preview,
      participants: (participants ?? []).map((p) => ({
        user_id: p.user_id,
        role: p.role,
      })),
      unread_count: unreadMessages.length,
    };

    logMessagesApi('POST', '/api/messages/conversations', userId, true);
    res.status(201).json({ success: true, data: summary });
  })
);

/**
 * GET /api/messages/conversations/:id
 *
 * Returns metadata and paginated messages for a conversation.
 */
router.get<
  { id: string },
  ApiResponse<{
    conversation: ConversationSummary;
    messages: MessageApiModel[];
    latestOffer?: Record<string, unknown> | null;
    offerActionability?: OfferActionabilityModel;
  }> | ApiResponse
>(
  '/conversations/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logMessagesApi('GET', '/api/messages/conversations/:id', undefined, false, 'Missing user_id');
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: participantRow, error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, last_read_at, role')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (participantError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations/:id',
        userId,
        false,
        participantError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load conversation' });
      return;
    }

    if (!participantRow) {
      logMessagesApi('GET', '/api/messages/conversations/:id', userId, false, 'Forbidden');
      res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
      return;
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select(
        'id, created_at, created_by, context_type, context_listing_id, context_contractor_id, last_message_at, last_message_preview'
      )
      .eq('id', id)
      .maybeSingle();

    if (conversationError || !conversation) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations/:id',
        userId,
        false,
        conversationError?.message || 'Not found'
      );
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, role, last_read_at')
      .eq('conversation_id', id);

    if (participantsError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations/:id',
        userId,
        false,
        participantsError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load participants' });
      return;
    }

    const limit = Number.parseInt((req.query.limit as string) || '50', 10);
    const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 50;
    const before = req.query.before as string | undefined;

    let messagesQuery = supabaseAdmin
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (before) {
      messagesQuery = messagesQuery.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      logMessagesApi(
        'GET',
        '/api/messages/conversations/:id',
        userId,
        false,
        messagesError.message
      );
      res.status(500).json({ success: false, error: 'Failed to load messages' });
      return;
    }

    const selfParticipant = participants?.find((p) => p.user_id === userId);
    const selfLastRead = selfParticipant?.last_read_at
      ? new Date(selfParticipant.last_read_at).getTime()
      : 0;

    const unreadMessages = (messages ?? []).filter(
      (m) =>
        new Date(m.created_at).getTime() > selfLastRead &&
        m.sender_id !== userId
    );

    const detailListingMap = await fetchListingMap(
      conversation.context_listing_id ? [conversation.context_listing_id] : []
    );
    const detailListing = conversation.context_listing_id
      ? detailListingMap.get(conversation.context_listing_id)
      : undefined;
    const { title: detailLTitle, address: detailLAddr } = listingLabel(detailListing);

    const summary: ConversationSummary = {
      id: conversation.id,
      context_type: conversation.context_type,
      context_listing_id: conversation.context_listing_id,
      context_contractor_id: conversation.context_contractor_id,
      context_listing_title: detailLTitle,
      context_listing_address: detailLAddr,
      last_message_at: conversation.last_message_at,
      last_message_preview: conversation.last_message_preview,
      participants: (participants ?? []).map((p) => ({
        user_id: p.user_id,
        role: p.role,
      })),
      unread_count: unreadMessages.length,
    };

    const apiMessages: MessageApiModel[] = (messages ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        body: m.body,
        created_at: m.created_at,
      }));

    const offerSelectNegotiation =
      'id, conversation_id, listing_id, landlord_id, renter_id, parent_offer_id, created_by, rate_type, rate_amount, currency, start_date, duration, subtotal_amount, platform_fee_amount, total_amount, status, notes, created_at, updated_at';

    const { data: pendingOffers } = await supabaseAdmin
      .from('offers')
      .select(offerSelectNegotiation)
      .eq('conversation_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    const pending = pendingOffers?.[0] ?? null;

    let latestOffer: Record<string, unknown> | null = pending;
    if (!latestOffer) {
      const { data: anyOffers } = await supabaseAdmin
        .from('offers')
        .select(offerSelectNegotiation)
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1);
      latestOffer = anyOffers?.[0] ?? null;
    }

    const offerActionability = computeOfferActionability(
      pending &&
        typeof pending.created_by === 'string' &&
        typeof pending.landlord_id === 'string' &&
        typeof pending.renter_id === 'string' &&
        typeof pending.status === 'string'
        ? {
            status: pending.status as 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'countered',
            created_by: pending.created_by,
            landlord_id: pending.landlord_id,
            renter_id: pending.renter_id,
          }
        : null,
      userId
    );

    logMessagesApi('GET', '/api/messages/conversations/:id', userId, true);
    res.json({
      success: true,
      data: {
        conversation: summary,
        messages: apiMessages,
        latestOffer,
        offerActionability,
      },
    });
  })
);

/**
 * POST /api/messages/conversations/:id/messages
 *
 * Sends a message in a conversation.
 */
router.post<
  { id: string },
  ApiResponse<MessageApiModel> | ApiResponse,
  { body: string }
>(
  '/conversations/:id/messages',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const { body } = req.body;

    if (!userId) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        undefined,
        false,
        'Missing user_id'
      );
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    if (!body || !body.trim()) {
      res.status(400).json({ success: false, error: 'Message body is required' });
      return;
    }

    const { data: participantRow, error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (participantError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        userId,
        false,
        participantError.message
      );
      res.status(500).json({ success: false, error: 'Failed to send message' });
      return;
    }

    if (!participantRow) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        userId,
        false,
        'Forbidden'
      );
      res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
      return;
    }

    const trimmed = body.trim();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: userId,
        body: trimmed,
      } as Partial<MessageRow>)
      .select('id, conversation_id, sender_id, body, created_at')
      .single();

    if (insertError || !inserted) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        userId,
        false,
        insertError?.message
      );
      res.status(500).json({ success: false, error: 'Failed to send message' });
      return;
    }

    const { error: updateConversationError } = await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: inserted.created_at,
        last_message_preview: trimmed.slice(0, 280),
      } as Partial<ConversationRow>)
      .eq('id', id);

    if (updateConversationError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        userId,
        false,
        updateConversationError.message
      );
    }

    const { error: updateReadError } = await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: inserted.created_at } as Partial<ConversationParticipantRow>)
      .eq('conversation_id', id)
      .eq('user_id', userId);

    if (updateReadError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/messages',
        userId,
        false,
        updateReadError.message
      );
    }

    const apiMessage: MessageApiModel = {
      id: inserted.id,
      conversation_id: inserted.conversation_id,
      sender_id: inserted.sender_id,
      body: inserted.body,
      created_at: inserted.created_at,
    };

    logMessagesApi(
      'POST',
      '/api/messages/conversations/:id/messages',
      userId,
      true
    );
    res.status(201).json({ success: true, data: apiMessage });
  })
);

/**
 * POST /api/messages/conversations/:id/read
 *
 * Marks the current user's conversation participant row as read.
 */
router.post<
  { id: string },
  ApiResponse | ApiResponse<null>
>(
  '/conversations/:id/read',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/read',
        undefined,
        false,
        'Missing user_id'
      );
      res.status(400).json({
        success: false,
        error: 'Missing user_id (X-User-Id header or user_id query param)',
      });
      return;
    }

    const { data: participantRow, error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (participantError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/read',
        userId,
        false,
        participantError.message
      );
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
      return;
    }

    if (!participantRow) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/read',
        userId,
        false,
        'Forbidden'
      );
      res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() } as Partial<ConversationParticipantRow>)
      .eq('conversation_id', id)
      .eq('user_id', userId);

    if (updateError) {
      logMessagesApi(
        'POST',
        '/api/messages/conversations/:id/read',
        userId,
        false,
        updateError.message
      );
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
      return;
    }

    logMessagesApi('POST', '/api/messages/conversations/:id/read', userId, true);
    res.json({ success: true, data: null });
  })
);

export default router;

