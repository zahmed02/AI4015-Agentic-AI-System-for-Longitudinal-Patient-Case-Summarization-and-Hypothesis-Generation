"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/** Thin bar that sweeps across the top on every navigation. */
export function RouteProgress() {
  const pathname = usePathname();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <motion.div
        key={pathname}
        className="h-full origin-left bg-linear-to-r from-cyan-400 via-emerald-400 to-violet-400"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{
          scaleX: { duration: 0.6, ease: "easeOut" },
          opacity: { delay: 0.45, duration: 0.3 },
        }}
      />
    </div>
  );
}