"use client";

import { motion } from "framer-motion";

/** Page transition between /notes and /settings. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
