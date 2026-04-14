"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function RouteLoader() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setProgress(0);
      setVisible(true);

      requestAnimationFrame(() => setProgress(70));

      const t1 = setTimeout(() => setProgress(100), 200);
      const t2 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      <div
        className="h-full bg-slate-900 transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "200ms" : "400ms",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
