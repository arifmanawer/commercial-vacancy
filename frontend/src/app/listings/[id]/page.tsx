"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Dummy data mirroring the browse page + extra details
// In a real app, this would be fetched from Supabase based on the ID.
const MOCK_DB: Record<string, any> = {
  "listing-1": {
    id: "listing-1",
    title: "Street-level Retail Space",
    location: "Downtown",
    address: "123 Main St, Downtown, Cityville",
    price: "$1,800 / month",
    type: "Retail",
    size: "1,200 sq ft",
    description:
      "High-visibility retail space with large storefront windows. Perfect for a boutique shop, cafe, or gallery. Located in the heart of the downtown arts district with heavy foot traffic.",
    amenities: ["High Ceilings", "Storefront Windows", "HVAC", "Private Restroom", "Storage Area"],
    images: ["/api/placeholder/800/600", "/api/placeholder/800/600", "/api/placeholder/800/600"],
    landlord: {
      name: "Sarah Jenkins",
      phone: "(555) 123-4567",
      email: "sarah@example.com",
    },
  },
  "listing-2": {
    id: "listing-2",
    title: "Loft Studio for Events",
    location: "Arts District",
    address: "456 Creative Way, Arts District",
    price: "$250 / day",
    type: "Event",
    size: "2,500 sq ft",
    description:
      "Open-concept industrial loft perfect for photo shoots, art exhibitions, or pop-up events. Features exposed brick walls, polished concrete floors, and abundant natural light.",
    amenities: ["Natural Light", "Freight Elevator", "WiFi", "Sound System", "Kitchenette"],
    images: ["/api/placeholder/800/600"],
    landlord: {
      name: "Mike Ross",
      phone: "(555) 987-6543",
      email: "mike@example.com",
    },
  },
  "listing-3": {
    id: "listing-3",
    title: "Flexible Office Suite",
    location: "Business Park",
    address: "789 Corp Blvd, Suite 200",
    price: "$900 / month",
    type: "Office",
    size: "500 sq ft",
    description:
      "Modern office suite in a professional business park. Includes access to shared conference rooms, break areas, and ample parking. Ideal for startups or small teams.",
    amenities: ["24/7 Access", "Conference Room", "High-speed Internet", "Parking", "Security"],
    images: ["/api/placeholder/800/600"],
    landlord: {
      name: "Jessica Pearson",
      phone: "(555) 555-5555",
      email: "jessica@example.com",
    },
  },
};

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolveParams = use(params);
  const { id } = resolveParams;

  const listing = MOCK_DB[id];
  const [activeImage, setActiveImage] = useState(0);

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Listing Not Found</h1>
            <p className="text-slate-600 mt-2">The listing you are looking for does not exist.</p>
            <Link href="/browse" className="mt-4 inline-block text-blue-600 hover:underline">
              Browse all spaces
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100 sticky top-0 bg-white z-50">
        <Navbar />
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / Back Link */}
        <Link
          href="/browse"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Browse
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN - Main Content */}
          <div className="lg:col-span-2 space-y-8">

            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-video w-full bg-slate-100 rounded-xl overflow-hidden shadow-sm relative group">
                {/* Main Image Placeholder */}
                <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                  <span className="text-lg font-medium">Image {activeImage + 1}</span>
                </div>

                {/* Image Navigation (if multiple) */}
                {listing.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImage(prev => (prev === 0 ? listing.images.length - 1 : prev - 1))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setActiveImage(prev => (prev === listing.images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      →
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {listing.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {listing.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`h-20 w-32 flex-shrink-0 rounded-lg border-2 overflow-hidden ${activeImage === idx ? "border-slate-900" : "border-transparent"
                        }`}
                    >
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                        Thumb {idx + 1}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Key Info */}
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{listing.title}</h1>
                  <p className="text-lg text-slate-600 mt-1">{listing.address}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                  {listing.type}
                </span>
              </div>

              <div className="flex gap-6 mt-6 border-y border-slate-100 py-4">
                <div>
                  <span className="block text-sm text-slate-500">Price</span>
                  <span className="text-lg font-semibold text-slate-900">{listing.price}</span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">Size</span>
                  <span className="text-lg font-semibold text-slate-900">{listing.size}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">About this space</h2>
              <p className="text-slate-600 leading-relaxed text-lg">
                {listing.description}
              </p>
            </section>

            {/* Amenities */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Amenities</h2>
              <ul className="grid grid-cols-2 gap-y-2 gap-x-4">
                {listing.amenities.map((amenity: string, idx: number) => (
                  <li key={idx} className="flex items-center text-slate-700">
                    <svg className="w-5 h-5 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>

            {/* Map Placeholder */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Location</h2>
              <div className="h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                Map Placeholder (Integration coming later)
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN - Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">

              {/* Contact Card */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Interested in this space?</h3>

                <div className="space-y-4">
                  <button className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
                    Contact Landlord
                  </button>
                  <button className="w-full bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                    Schedule a Tour
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3">Listed by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{listing.landlord.name}</p>
                      <p className="text-xs text-slate-500">Landlord</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety/Info Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="flex items-center text-sm font-semibold text-slate-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Leasing Info
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Minimum lease term of 12 months required. Security deposit equals one month's rent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
