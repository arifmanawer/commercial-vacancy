import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * GET /api/renters/dashboard
 * Consolidated renter dashboard payload. Uses admin client to avoid browser auth lock/RLS issues.
 */
router.get(
  "/dashboard",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // 1) Saved listings -> listing details + images
    const { data: savedRows, error: savedErr } = await supabaseAdmin
      .from("saved_listings")
      .select("property_id")
      .eq("user_id", userId);
    if (savedErr) {
      res.status(500).json({ success: false, error: "Failed to load saved listings" });
      return;
    }

    const propertyIds = (savedRows ?? [])
      .map((r: any) => r.property_id as string | null)
      .filter((v): v is string => Boolean(v));

    let savedListings: any[] = [];
    if (propertyIds.length) {
      const { data: listingRows, error: listingErr } = await supabaseAdmin
        .from("listings")
        .select("id, title, city, state, property_type, rate_type, rate_amount")
        .in("id", propertyIds);
      if (listingErr) {
        res.status(500).json({ success: false, error: "Failed to load listing details" });
        return;
      }

      const { data: imgRows, error: imgErr } = await supabaseAdmin
        .from("listings_images")
        .select("property_id, image_url")
        .in("property_id", propertyIds);
      if (imgErr) {
        res.status(500).json({ success: false, error: "Failed to load listing images" });
        return;
      }

      const imgMap = new Map<string, any>();
      (imgRows ?? []).forEach((r: any) => imgMap.set(r.property_id, r));

      savedListings =
        (listingRows ?? []).map((r: any) => ({
          id: r.id,
          title: r.title,
          city: r.city ?? null,
          state: r.state ?? null,
          property_type: r.property_type ?? null,
          rate_amount: r.rate_amount ?? null,
          rate_type: r.rate_type ?? null,
          image: imgMap.get(r.id)?.image_url?.[0] ?? null,
        })) ?? [];
    }

    // 2) Inquiries -> listing info map
    const { data: inquiryRows, error: inquiryErr } = await supabaseAdmin
      .from("listing_inquiries")
      .select(
        "id, listing_id, type, message, preferred_time, status, landlord_message, landlord_suggested_time, created_at, resolved_at",
      )
      .eq("renter_id", userId)
      .order("created_at", { ascending: false });
    if (inquiryErr) {
      res.status(500).json({ success: false, error: "Failed to load inquiries" });
      return;
    }

    const inquiryListingIds = Array.from(
      new Set((inquiryRows ?? []).map((r: any) => r.listing_id).filter(Boolean)),
    ) as string[];

    let inquiryListings: any[] = [];
    if (inquiryListingIds.length) {
      const { data: inqListingRows, error: inqListingErr } = await supabaseAdmin
        .from("listings")
        .select("id, title, city, state, property_type")
        .in("id", inquiryListingIds);
      if (inqListingErr) {
        res.status(500).json({ success: false, error: "Failed to load inquiry listings" });
        return;
      }
      inquiryListings = inqListingRows ?? [];
    }

    // 3) Upcoming bookings count
    const activeStatuses = ["pending_payment", "reserved", "active"];
    const { data: bookingRows, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, renter_id, start_datetime, end_datetime, status")
      .eq("renter_id", userId)
      .in("status", activeStatuses);
    if (bookingErr) {
      res.status(500).json({ success: false, error: "Failed to load bookings" });
      return;
    }
    const now = Date.now();
    const upcomingBookingsCount = (bookingRows ?? []).filter((b: any) => {
      const end = new Date(b.end_datetime).getTime();
      return Number.isFinite(end) && end >= now;
    }).length;

    res.json({
      success: true,
      data: {
        savedListings,
        inquiries: inquiryRows ?? [],
        listings: inquiryListings,
        upcomingBookingsCount,
      },
    });
  }),
);

/**
 * GET /api/renters/reservations
 * Full reservations list for the renter.
 */
router.get(
  "/reservations",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const { data: bookingRows, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, currency, total_amount, created_at",
      )
      .eq("renter_id", userId)
      .order("start_datetime", { ascending: true });
    if (bookingErr) {
      res.status(500).json({ success: false, error: "Failed to load reservations" });
      return;
    }

    const listingIds = Array.from(
      new Set((bookingRows ?? []).map((b: any) => b.listing_id).filter(Boolean)),
    ) as string[];

    let listingRows: any[] = [];
    let imgRows: any[] = [];
    if (listingIds.length) {
      const { data: lRows, error: lErr } = await supabaseAdmin
        .from("listings")
        .select("id, title, city, state, property_type")
        .in("id", listingIds);
      if (lErr) {
        res.status(500).json({ success: false, error: "Failed to load reservation listings" });
        return;
      }
      listingRows = lRows ?? [];

      const { data: iRows, error: iErr } = await supabaseAdmin
        .from("listings_images")
        .select("property_id, image_url")
        .in("property_id", listingIds);
      if (iErr) {
        res.status(500).json({ success: false, error: "Failed to load reservation images" });
        return;
      }
      imgRows = iRows ?? [];
    }

    const listingMap = new Map<string, any>();
    listingRows.forEach((l: any) => listingMap.set(l.id, l));
    const imageMap = new Map<string, any>();
    imgRows.forEach((r: any) => imageMap.set(r.property_id, r));

    const mapped = (bookingRows ?? []).map((b: any) => ({
      ...b,
      listing: listingMap.get(b.listing_id) ?? null,
      image: imageMap.get(b.listing_id)?.image_url?.[0] ?? null,
    }));

    res.json({ success: true, data: mapped });
  }),
);

export default router;

