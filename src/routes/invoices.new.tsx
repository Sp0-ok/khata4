import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invoices.new")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
