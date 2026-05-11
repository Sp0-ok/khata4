import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { SaveFolderPicker } from "@/components/SaveFolderPicker";
import { useAutoSync } from "@/lib/sync";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0d9488" },
      { title: "Hisaab Kitaab — Digital Khata for Small Business" },
      { name: "description", content: "Free offline Digital Khata, ledger and bookkeeping app. No ads, no subscriptions, no tracking." },
      { property: "og:title", content: "Hisaab Kitaab — Digital Khata" },
      { property: "og:description", content: "Replace your physical bahi-khata. Track parties, payments and balances offline." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Suppress the WebView long-press context popup that shows the URL.
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", stop);
    return () => document.removeEventListener("contextmenu", stop);
  }, []);

  // Native Android back button: exit if at a top-level tab, otherwise go back.
  useEffect(() => {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const TOP = new Set(["/", "/customers", "/invoices", "/expenses", "/reports", "/settings"]);
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    import("@capacitor/app").then(({ App }) => {
      if (cancelled) return;
      App.addListener("backButton", () => {
        const path = window.location.pathname.replace(/\/$/, "") || "/";
        if (TOP.has(path)) {
          App.exitApp();
        } else {
          window.history.back();
        }
      }).then(s => { sub = s; });
    }).catch(() => undefined);
    return () => { cancelled = true; sub?.remove?.(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RoutePreloader />
        <SyncMount />
        <Outlet />
        <Toaster position="top-center" />
        <SaveFolderPicker />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function SyncMount() {
  const { pendingDecision, resolveDecision } = useAutoSync();
  const open = !!pendingDecision;
  const when = pendingDecision ? new Date(pendingDecision.cloudUpdatedAt).toLocaleString() : "";
  const dev = pendingDecision?.cloudDevice || "another device";
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) resolveDecision("dismiss"); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore cloud backup?</AlertDialogTitle>
          <AlertDialogDescription>
            We found a newer backup in your account from <strong>{dev}</strong> ({when}).
            Restoring will replace the data on this device. Keeping local will overwrite the cloud on the next change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveDecision("overwrite")}>Keep local</AlertDialogCancel>
          <AlertDialogAction onClick={() => resolveDecision("restore")}>Restore from cloud</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Warm the bundle for every primary nav target after the first paint so
// switching tabs is instant — important inside the Android WebView where
// each new chunk fetch from disk still takes a frame or two.
function RoutePreloader() {
  const router = useRouter();
  useEffect(() => {
    const targets = ["/", "/customers", "/invoices", "/expenses", "/reports", "/settings"];
    const run = () => {
      for (const to of targets) {
        router.preloadRoute({ to } as any).catch(() => undefined);
      }
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 400);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [router]);
  return null;
}

