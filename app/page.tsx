import { GalaxyExperience } from "@/components/GalaxyExperience";

export default function Home() {
  return (
    <main className="h-dvh">
      <h1 className="sr-only">GitHubble: explore GitHub repositories as a galaxy</h1>
      <GalaxyExperience />
    </main>
  );
}
