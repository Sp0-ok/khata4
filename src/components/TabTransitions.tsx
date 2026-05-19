import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

const TABS = ["/", "/customers", "/invoices", "/expenses", "/reports"] as const;

function tabIndex(pathname: string): number {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/") return 0;
  for (let i = 1; i < TABS.length; i++) {
    if (p.startsWith(TABS[i])) return i;
  }
  return -1;
}

export function TabTransitions({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const currentIdx = tabIndex(loc.pathname);
  const isTab = currentIdx >= 0;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const decided = useRef(false);
  const widthRef = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Reset transform when route changes (tap or post-swipe).
  useEffect(() => {
    setDragX(0);
    setAnimating(false);
  }, [currentIdx]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isTab) return;
    const t = e.touches[0];
    // Ignore edge swipes (Android back gesture).
    if (t.clientX < 20 || t.clientX > window.innerWidth - 20) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = false;
    decided.current = false;
    widthRef.current = wrapperRef.current?.clientWidth ?? window.innerWidth;
    setAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isTab || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (!decided.current) {
      // Need ~10px of motion before we decide horizontal vs vertical.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        dragging.current = true;
      }
      decided.current = true;
    }

    if (!dragging.current) return;

    // Resist past first/last tab.
    let delta = dx;
    if ((currentIdx === 0 && delta > 0) || (currentIdx === TABS.length - 1 && delta < 0)) {
      delta = delta / 3;
    }
    setDragX(delta);
  };

  const onTouchEnd = () => {
    if (!isTab) return;
    const wasDragging = dragging.current;
    const dx = dragX;
    startX.current = null;
    startY.current = null;
    dragging.current = false;
    decided.current = false;

    if (!wasDragging) return;

    const width = widthRef.current || window.innerWidth;
    const threshold = width * 0.4;

    if (dx <= -threshold && currentIdx < TABS.length - 1) {
      // Snap forward to next tab.
      setAnimating(true);
      setDragX(-width);
      window.setTimeout(() => {
        navigate({ to: TABS[currentIdx + 1] as any, replace: true });
      }, 150);
    } else if (dx >= threshold && currentIdx > 0) {
      setAnimating(true);
      setDragX(width);
      window.setTimeout(() => {
        navigate({ to: TABS[currentIdx - 1] as any, replace: true });
      }, 150);
    } else {
      // Snap back.
      setAnimating(true);
      setDragX(0);
      window.setTimeout(() => setAnimating(false), 160);
    }
  };

  if (!isTab) return <>{children}</>;

  return (
    <div ref={wrapperRef} className="relative overflow-x-hidden min-h-screen">
      <div
        ref={contentRef}
        className="min-h-screen"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: animating ? "transform 150ms ease-out" : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
