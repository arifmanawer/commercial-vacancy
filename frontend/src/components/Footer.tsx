import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between text-sm text-slate-600">
        <div className="flex gap-4">
          <Link href="/terms" className="hover:underline focus:outline-none focus:ring-2 focus:ring-slate-200 rounded">
            Terms
          </Link>
          <Link href="/privacy" className="hover:underline focus:outline-none focus:ring-2 focus:ring-slate-200 rounded">
            Privacy
          </Link>
          <Link href="/contact" className="hover:underline focus:outline-none focus:ring-2 focus:ring-slate-200 rounded">
            Contact
          </Link>
        </div>

        <div className="mt-3 md:mt-0">
          © {new Date().getFullYear()} Smart Vacancy Reuse Platform
        </div>
      </div>
    </footer>
  );
}
