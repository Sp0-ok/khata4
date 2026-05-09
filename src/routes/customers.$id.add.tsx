import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers._id.add")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
