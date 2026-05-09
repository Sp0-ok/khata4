import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers._id.index")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
