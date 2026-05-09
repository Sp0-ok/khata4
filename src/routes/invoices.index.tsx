import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invoices.index")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
