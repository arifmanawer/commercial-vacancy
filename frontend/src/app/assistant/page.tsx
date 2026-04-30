import { Suspense } from "react";
import AssistantClient from "./assistantClient";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const listingIdRaw = sp.listingId;
  const listingId = Array.isArray(listingIdRaw) ? listingIdRaw[0] : listingIdRaw || "";

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading…</div>}>
      <AssistantClient listingId={listingId} />
    </Suspense>
  );
}

