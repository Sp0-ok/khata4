import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers._id.txn._txnId")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
