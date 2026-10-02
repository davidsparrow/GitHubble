import { decodeGalaxy } from "@/lib/galaxyPayload";
import { createDataset, getSampleDataset, getSyntheticDataset, type GalaxyDataset } from "@/lib/repositoryData";

/**
 * Which galaxy the app shows:
 *   ?stress=N  a synthetic universe of N repositories (performance testing)
 *   ?sample    the built-in sample universe
 *   otherwise  the live galaxy from /api/galaxy, falling back to the sample
 *              universe when it isn't available yet
 */
export async function loadGalaxyDataset(): Promise<GalaxyDataset> {
  const params = new URLSearchParams(window.location.search);
  const stress = Number(params.get("stress"));
  if (Number.isFinite(stress) && stress > 0) return getSyntheticDataset(stress);
  if (params.has("sample")) return getSampleDataset();

  try {
    const response = await fetch("/api/galaxy");
    if (response.status === 200) {
      const { repositories, indexedAt } = decodeGalaxy(await response.json());
      if (repositories.length > 0) return createDataset(repositories, { source: "live", indexedAt });
    }
  } catch (error) {
    console.info("[githubble] Live galaxy unavailable, showing the sample universe.", error);
  }
  return getSampleDataset();
}
