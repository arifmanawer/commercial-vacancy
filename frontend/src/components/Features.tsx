export default function Features() {
  const items = [
    {
      title: "Verified Listings",
      desc: "All listings are vetted to ensure reliability and accurate descriptions.",
    },
    {
      title: "Instant Booking",
      desc: "Quickly reserve spaces with clear availability and pricing.",
    },
    {
      title: "Direct Communication",
      desc: "Message hosts directly to coordinate details and requests.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex gap-4 items-start p-5 sm:p-6 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--brand)]/20 transition-all duration-200"
        >
          <div className="w-11 h-11 rounded-xl bg-[var(--brand-muted)] flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--brand)] text-base font-bold">✓</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900">{item.title}</h4>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
