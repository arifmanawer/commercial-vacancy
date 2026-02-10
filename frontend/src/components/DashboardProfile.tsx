export default function DashboardProfile() {
  // Placeholder data — replace with real user/session data when auth is wired
  const profile = {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+1 (555) 123-4567",
    memberSince: "January 2025",
  };

  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="profile-heading" className="sr-only">
        Profile
      </h2>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-500 text-lg font-semibold">
          {profile.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-lg font-semibold text-slate-900 truncate">
            {profile.name}
          </p>
          <p className="text-sm text-slate-600 truncate">{profile.email}</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-2">
            <div>
              <span className="sr-only">Phone</span>
              <span>{profile.phone}</span>
            </div>
            <div>
              <span className="sr-only">Member since</span>
              <span>Member since {profile.memberSince}</span>
            </div>
          </dl>
        </div>
        <button
          type="button"
          className="self-start sm:self-center shrink-0 text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Edit profile
        </button>
      </div>
    </section>
  );
}
