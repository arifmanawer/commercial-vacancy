"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getApiUrl } from "@/lib/api";
import ProfileReviews from "@/components/ProfileReviews";

type PublicProfileInfo = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  description: string | null;
  created_at: string;
  is_landlord: boolean;
  is_contractor: boolean;
};

export default function PublicProfilePage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfileInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    let cancelled = false;
    async function fetchProfile() {
      setLoading(true);
      setNotFound(false);
      
      try {
        const normalizedId = id.replace(/%20/g, '-').replace(/ /g, '-');
        
        const res = await fetch(`${getApiUrl()}/api/profiles/public/${normalizedId}`);
        const result = await res.json();
        
        if (!res.ok || !result.success || !result.data) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!cancelled) {
          setProfile(result.data as PublicProfileInfo);
        }
      } catch (err) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <Navbar />
        </header>
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-pulse space-y-4">
            <div className="h-24 w-24 bg-slate-200 rounded-full mx-auto" />
            <div className="h-8 w-48 bg-slate-200 rounded mx-auto" />
            <div className="h-4 w-32 bg-slate-200 rounded mx-auto" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <Navbar />
        </header>
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">User Not Found</h1>
            <p className="text-slate-600 mt-2">The profile you are looking for does not exist.</p>
            <Link href="/" className="mt-4 inline-block text-slate-900 hover:text-slate-700 hover:underline">
              Return Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || "User";

  const joinedDate = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <Navbar />
      </header>
      
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="h-32 w-32 rounded-full border-4 border-white shadow-md bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
              {profile.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profile_picture_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl text-slate-400 font-semibold mb-1">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left mt-2 sm:mt-0">
              <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
              {profile.username && (
                <p className="text-slate-500 font-medium text-lg mt-1">@{profile.username}</p>
              )}
              
              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
                {profile.is_landlord && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-900 text-white text-sm font-medium shadow-sm">
                    Landlord
                  </span>
                )}
                {profile.is_contractor && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100">
                    Contractor
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200">
                  Joined {joinedDate}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-10 pt-8 border-t border-slate-100">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">About</h2>
            {profile.description ? (
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-lg">
                {profile.description}
              </p>
            ) : (
              <p className="text-slate-400 italic">No description provided.</p>
            )}
          </div>

          <ProfileReviews targetUserId={profile.id} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
