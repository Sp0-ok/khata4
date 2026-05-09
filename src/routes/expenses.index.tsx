import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/expenses.index")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
