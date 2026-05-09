import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers._id.edit")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
