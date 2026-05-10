import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background/40">
      <main className={hideNav ? "flex-1" : "flex-1 pb-24"}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-card/80 px-4 pb-3 backdrop-blur-lg">
      <div className="flex items-center gap-3">
        {back}
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
