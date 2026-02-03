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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex gap-4 items-start p-4 border border-slate-200 rounded-md"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-400 text-xs">●</span>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
