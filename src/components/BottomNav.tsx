import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/customers", label: "Parties", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        {items.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to as any}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn(
                "flex h-9 w-12 items-center justify-center rounded-full transition-all",
                active && "bg-accent"
              )}>
                <Icon className={cn("h-5 w-5", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
