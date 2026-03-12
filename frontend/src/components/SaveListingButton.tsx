"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type SaveListingButtonProps = {
  propertyId: string;
  /**
   * Optional controlled saved state. When provided, the button will not
   * issue an initial fetch and will trust this value as source of truth.
   */
  isSaved?: boolean;
  /**
   * Optional disabled flag from parent (e.g. while loading list state).
   */
  disabled?: boolean;
  /**
   * Notify parent when the saved state successfully changes.
   */
  onChange?: (nextSaved: boolean) => void;
  /**
   * Surface user-facing errors to the parent (e.g. to show a toast/banner).
   */
  onError?: (message: string | null) => void;
  /**
   * Optional extra Tailwind classes to customize layout/size in specific
   * contexts (e.g. full-width on detail page).
   */
  className?: string;
};

export function SaveListingButton({
  propertyId,
  isSaved,
  disabled,
  onChange,
  onError,
  className,
}: SaveListingButtonProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [saving, setSaving] = useState(false);
  const [internalSaved, setInternalSaved] = useState<boolean | null>(
    typeof isSaved === "boolean" ? isSaved : null,
  );

  // Sync internal state when parent controls isSaved.
  useEffect(() => {
    if (typeof isSaved === "boolean") {
      setInternalSaved(isSaved);
    }
  }, [isSaved]);

  // When parent does not control isSaved, lazily load initial saved state.
  useEffect(() => {
    if (typeof isSaved === "boolean") return;
    if (!userId) {
      setInternalSaved(false);
      return;
    }

    let cancelled = false;

    async function loadInitialSaved() {
      try {
        const { data, error } = await supabase
          .from("saved_listings")
          .select("id")
          .eq("user_id", userId)
          .eq("property_id", propertyId)
          .maybeSingle();

        if (error) {
          if (!cancelled) {
            onError?.(error.message ?? "Unable to load saved status.");
          }
          return;
        }

        if (!cancelled) {
          setInternalSaved(!!data);
        }
      } catch {
        if (!cancelled) {
          onError?.("Unable to load saved status.");
        }
      }
    }

    // Only fetch once per mount when we don't yet know.
    if (internalSaved === null) {
      loadInitialSaved();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, propertyId, isSaved]);

  const effectiveSaved =
    typeof isSaved === "boolean"
      ? isSaved
      : internalSaved !== null
        ? internalSaved
        : false;

  async function handleClick() {
    onError?.(null);

    if (!userId) {
      onError?.("Please sign in to save spaces.");
      return;
    }

    if (saving) return;

    const currentlySaved = effectiveSaved;

    setSaving(true);
    try {
      if (currentlySaved) {
        const { error: deleteError } = await supabase
          .from("saved_listings")
          .delete()
          .eq("user_id", userId)
          .eq("property_id", propertyId);

        if (deleteError) {
          onError?.(
            deleteError.message ?? "Unable to remove this saved space.",
          );
          return;
        }

        if (typeof isSaved !== "boolean") {
          setInternalSaved(false);
        }
        onChange?.(false);
      } else {
        const { error: insertError } = await supabase
          .from("saved_listings")
          .insert({
            user_id: userId,
            property_id: propertyId,
          });

        if (insertError) {
          const msg = insertError.message ?? "";
          const errorWithCode = insertError as {
            code?: string | undefined;
            message?: string | null;
          };
          const isDuplicate =
            errorWithCode.code === "23505" ||
            msg.toLowerCase().includes("duplicate");

          if (!isDuplicate) {
            onError?.(insertError.message ?? "Unable to save this space.");
            return;
          }
        }

        if (typeof isSaved !== "boolean") {
          setInternalSaved(true);
        }
        onChange?.(true);
      }
    } catch {
      onError?.("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={effectiveSaved}
      onClick={handleClick}
      disabled={saving || disabled}
      className={`inline-flex items-center justify-center text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20 disabled:opacity-60 disabled:cursor-default ${
        effectiveSaved
          ? "border-[var(--brand)]/30 text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
          : "border-slate-200 text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)]"
      } ${className ?? ""}`}
    >
      {saving
        ? "Saving..."
        : effectiveSaved
          ? "Unsave"
          : "Save space"}
    </button>
  );
}

