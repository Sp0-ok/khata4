import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";

const TABS = ["/", "/customers", "/invoices", "/expenses", "/reports"] as const;

function tabIndex(pathname: string): number {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/") return 0;
  const idx = TABS.findIndex((t, i) => i > 0 && p.startsWith(t));
  return idx;
}

export function TabTransitions({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const currentIdx = tabIndex(loc.pathname);
  const isTab = currentIdx >= 0;
  const prevIdxRef = useRef<number>(currentIdx >= 0 ? currentIdx : 0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (currentIdx >= 0) {
      const prev = prevIdxRef.current;
      setDirection(currentIdx > prev ? 1 : currentIdx < prev ? -1 : 0);
      prevIdxRef.current = currentIdx;
    }
  }, [currentIdx]);

  // Swipe gesture — only when on a tab route.
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isTab) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    swiped.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isTab || swiped.current || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    // Ignore edge swipes — Android back gesture territory.
    if (startX.current < 24 || startX.current > window.innerWidth - 24) return;
    const next = dx < 0 ? currentIdx + 1 : currentIdx - 1;
    if (next < 0 || next >= TABS.length) return;
    swiped.current = true;
    navigate({ to: TABS[next] as any, replace: true });
  };
  const onTouchEnd = () => {
    startX.current = null;
    startY.current = null;
  };

  if (!isTab) return <>{children}</>;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative overflow-x-hidden"
    >
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={currentIdx}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d === 0 ? 0 : d > 0 ? "100%" : "-100%", opacity: 0.6 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0.6 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
