
"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import CreateListingForm from "@/components/CreateListingForm";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ListingFormInput = {
  title: string;
  description?: string;
  address: string;
  property_type: string;
  city: string;
  state: string;
  zip_code: string;
  price: string | number;
  security_deposit?: string | number;
  rental_type: string;
  photos?: File[];
};

export default function ListPage() {
  const { user, isLandlord, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateListing(data: ListingFormInput) {
    if (!user) {
      alert("You must be signed in to create a listing.");
      return;
    }

    setSubmitting(true);
    try {
      // Insert listing row
      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .insert([
            {
              user_id: user.id,
              title: data.title,
              description: data.description ?? null,
              address: data.address,
              property_type: data.property_type,
              city: data.city,
              state: data.state,
              zip_code: data.zip_code,
            },
          ])
        .select()
        .single();

      if (listingError || !listingData) {
        throw listingError ?? new Error("Failed to create listing");
      }

      const listingId = listingData.id;

      // Upload photos to Supabase storage (bucket: property-photos)
      const photoFiles = data.photos ?? [];
      const publicUrls: string[] = [];

      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        const fileExt = file.name.split(".").pop();
        const filename = `listings/${listingId}/${Date.now()}-${i}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("listing_photos")
          .upload(filename, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.warn("upload error", uploadError.message);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("listing_photos")
          .getPublicUrl(uploadData.path);

        publicUrls.push(urlData.publicUrl);
      }

      // Insert pricing
      const { error: priceErr } = await supabase.from("property_pricing").insert([
        {
          property_id: listingId,
          price: data.price,
          security_deposit: data.security_deposit ?? null,
          rental_type: data.rental_type,
        },
      ]);
      if (priceErr) console.warn("pricing insert error", priceErr.message);

      // Insert images record (store urls as array)
      if (publicUrls.length > 0) {
        const { error: imgErr } = await supabase.from("listings_images").insert([
          {
            property_id: listingId,
            image_url: publicUrls,
            is_primary: true,
            display_order: 0,
          },
        ]);
        if (imgErr) console.warn("images insert error", imgErr.message);
      }

      // Redirect to browse so listing is visible
      router.push("/browse");
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>
      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[#0d4f4f] transition-colors mb-8"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">List Your Space</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          Add your commercial property to the platform. Provide details,
          upload photos, and start receiving inquiries from interested renters.
        </p>

        <section className="mt-10" aria-labelledby="what-you-need-heading">
          <h2
            id="what-you-need-heading"
            className="text-lg font-semibold text-slate-900 mb-3"
          >
            What you&apos;ll need
          </h2>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Property address and basic details</li>
            <li>Photos of the space</li>
            <li>Description and amenities</li>
            <li>Availability and pricing</li>
          </ul>
        </section>

        <div className="mt-8">
          {loading ? (
            <div>Loading...</div>
          ) : user ? (
            isLandlord ? (
              <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
                <CreateListingForm onSubmit={handleCreateListing} />
              </div>
            ) : (
              <Link
                href="/profile"
                className="inline-flex items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              >
                Become a landlord to list your space
              </Link>
            )
          ) : (
            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
            >
              Sign up to list your space
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
