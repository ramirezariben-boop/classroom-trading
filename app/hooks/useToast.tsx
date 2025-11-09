// app/hooks/useToast.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastColor = "green" | "red" | "blue" | "yellow";

export function useToast() {
  const [toasts, setToasts] = useState<
    { id: number; msg: string; color: ToastColor }[]
  >([]);

  const showToast = useCallback((msg: string, color: ToastColor = "blue") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, color }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const ToastComponent = () => (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] space-y-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              px-4 py-2 rounded-xl font-medium text-sm shadow-lg
              backdrop-blur-md border 
              bg-opacity-80 border-opacity-40
              text-white text-center mx-auto w-[260px]
              ${
                t.color === "green"
                  ? "bg-emerald-700/60 border-emerald-500/40"
                  : t.color === "red"
                  ? "bg-red-700/60 border-red-500/40"
                  : t.color === "yellow"
                  ? "bg-yellow-600/60 border-yellow-400/40 text-black"
                  : "bg-blue-700/60 border-blue-500/40"
              }
            `}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return { showToast, ToastComponent };
}
