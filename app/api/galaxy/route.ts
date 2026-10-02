import { loadGalaxyPayload } from "@/server/galaxyData";

/**
 * GET /api/galaxy: every repository in the galaxy, compactly encoded
 * (lib/galaxyPayload.ts). Successful responses are cached at the CDN for ten
 * minutes and served stale while revalidating. When no galaxy is configured
 * yet the response is 204 (the app shows its sample universe); failures are
 * 503. Neither is cached.
 */
export async function GET() {
  try {
    const payload = await loadGalaxyPayload();
    if (!payload || payload.repositories.length === 0) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("[api/galaxy]", error);
    return Response.json({ error: "galaxy_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
