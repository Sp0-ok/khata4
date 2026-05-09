import { createFileRoute } from "@tanstack/react-router";
import { AndroidApp } from "@/mobile/AndroidApp";

export const Route = createFileRoute("/")({
  component: AndroidApp,
});
