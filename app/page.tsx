import AppShell from "@/components/AppShell";

// The whole reviewer experience is one page (brief file 02 §0: "no sign-in,
// no landing page"). AppShell is a client component — it fetches each
// scenario's result from /api/scenario itself, which is what lets the
// loading state in file 02 §8 actually show.
export default function Home() {
  return <AppShell />;
}
