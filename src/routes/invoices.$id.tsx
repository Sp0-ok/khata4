import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invoices._id")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
