import { createRandom } from "../random";
import type { RepositorySeed } from "./sampleRepositories";

/**
 * Remixes the sample seeds into `count` plausible repositories with a realistic,
 * long-tailed star distribution. For performance testing only (`?stress=10000`);
 * the names are not real repositories.
 */
export function syntheticSeeds(base: readonly RepositorySeed[], count: number): RepositorySeed[] {
  const random = createRandom(count);
  const seeds = [...base];
  for (let i = seeds.length; i < count; i++) {
    const template = base[Math.floor(random() * base.length)];
    const [owner, name] = template.fullName.split("/");
    seeds.push({
      ...template,
      fullName: `${owner}-community/${name}-${(i + 1).toString(36)}`,
      // Mostly small projects, occasionally a big one: 50 → ~100k stars.
      stars: Math.round(10 ** (1.7 + Math.pow(random(), 1.8) * 3.3)),
      description: `Community project in the ${template.problemCategory} space. ${template.description}`,
    });
  }
  return seeds;
}
