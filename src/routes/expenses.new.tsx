import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/expenses.new")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
