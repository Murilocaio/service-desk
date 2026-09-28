import { createFileRoute, redirect } from "@tanstack/react-router";

// The home route has no UI of its own: send visitors to the dashboard. The
// /_authenticated guard bounces them on to /auth when there is no session.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
