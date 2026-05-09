import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers.new")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
