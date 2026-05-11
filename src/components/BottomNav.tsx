import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, FileText, Receipt, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/customers", label: "Parties", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
        {items.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to as any}
              replace
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn(
                "flex h-8 w-12 items-center justify-center rounded-full transition-all",
                active && "bg-accent"
              )}>
                <Icon className={cn("h-[18px] w-[18px]", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
