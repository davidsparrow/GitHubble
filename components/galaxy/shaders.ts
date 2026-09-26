import { MAX_ZOOM_SIZE_SCALE, MIN_ZOOM_SIZE_SCALE, REFERENCE_PX_PER_UNIT, ZOOM_SIZE_EXPONENT } from "@/lib/starScale";

/*
 * All materials use premultiplied additive blending (ONE, ONE) and write sRGB
 * colors directly: fragment shaders output `vec4(color * intensity, 1.0)`.
 */

const f = (value: number) => value.toFixed(5);

/** Shared with lib/starScale.ts so CPU picking agrees with what the GPU draws. */
const STAR_SIZE = /* glsl */ `
  float starZoomScale(float pxPerUnit) {
    return clamp(
      pow(pxPerUnit / ${f(REFERENCE_PX_PER_UNIT)}, ${f(ZOOM_SIZE_EXPONENT)}),
      ${f(MIN_ZOOM_SIZE_SCALE)},
      ${f(MAX_ZOOM_SIZE_SCALE)}
    );
  }

  // Projected pixels per world unit at view-space depth \`depth\`.
  float pixelsPerUnit(float depth, float viewportHeight) {
    return projectionMatrix[1][1] * 0.5 * viewportHeight / max(depth, 0.001);
  }

  // Intro: light spreads from the core outwards as uReveal goes 0 → 1.
  float revealAt(vec3 p, float reveal, float extent) {
    float radial = clamp(length(p.xz) / extent, 0.0, 1.0);
    return smoothstep(radial * 0.75, radial * 0.75 + 0.25, reveal);
  }
`;

// ── Repository stars ────────────────────────────────────────────────────────

export const starVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uViewportHeight;
  uniform float uMaxPointSize;
  uniform float uReveal;
  uniform float uHovered;
  uniform float uSelected;

  attribute float aSize;
  attribute float aMagnitude;
  attribute vec3 aColor;
  attribute float aVisibility;
  attribute float aHighlight;
  attribute float aIndex;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vIntensity;
  varying float vSpikes;
  varying float vCore;
  varying float vHalo;
  varying float vPointSize;

  ${STAR_SIZE}

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float hovered = 1.0 - step(0.5, abs(aIndex - uHovered));
    float selected = 1.0 - step(0.5, abs(aIndex - uSelected));
    float reveal = revealAt(position, uReveal, 110.0);

    float emphasis = 1.0 + 0.4 * hovered + 0.3 * selected + 0.15 * aHighlight;
    float size = aSize * starZoomScale(pixelsPerUnit(-mvPosition.z, uViewportHeight))
      * emphasis * mix(0.55, 1.0, aVisibility) * reveal;
    float pointSize = min(size * uPixelRatio, uMaxPointSize);
    gl_PointSize = pointSize;
    if (reveal < 0.001) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);

    float twinkle = 1.0 + 0.07 * sin(uTime * (0.6 + aSeed * 1.9) + aSeed * 61.0);
    vIntensity = (0.5 + 0.5 * aMagnitude) * aVisibility * twinkle * reveal
      * (1.0 + 0.55 * hovered + 0.45 * selected + 0.35 * aHighlight);
    vColor = aColor;
    vSpikes = smoothstep(0.74, 0.96, aMagnitude) * mix(0.3, 1.0, aVisibility);
    vHalo = 0.35 + 0.65 * aMagnitude;
    vPointSize = max(pointSize, 1.0);
    // Core radius as a fraction of the sprite radius, never below ~1.2 device px.
    vCore = clamp((1.2 * uPixelRatio + pointSize * 0.075) / max(pointSize * 0.5, 0.001), 0.08, 0.9);
  }
`;

export const starFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  varying float vSpikes;
  varying float vCore;
  varying float vHalo;
  varying float vPointSize;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float core = exp(-pow(r / vCore, 2.0) * 2.2);
    float halo = pow(1.0 - r, 2.2) * 0.7 * vHalo;
    // Hubble-style diffraction spikes on the brightest stars, about a device pixel wide.
    float pixel = 2.0 / vPointSize;
    float spikes = vSpikes * 0.75 * (
      exp(-abs(p.x) / (1.1 * pixel)) * pow(1.0 - abs(p.y), 1.6) +
      exp(-abs(p.y) / (1.1 * pixel)) * pow(1.0 - abs(p.x), 1.6)
    );

    vec3 color = mix(vColor, vec3(1.0), clamp(core * 1.1, 0.0, 1.0));
    gl_FragColor = vec4(color * (core + halo + spikes) * vIntensity, 1.0);
  }
`;

// ── Galaxy dust (decorative, non-interactive) ───────────────────────────────

export const dustVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uViewportHeight;
  uniform float uReveal;

  attribute float aSize;
  attribute vec3 aColor;
  attribute float aBrightness;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vIntensity;

  ${STAR_SIZE}

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float zoom = clamp(pow(pixelsPerUnit(-mvPosition.z, uViewportHeight) / 5.0, 0.3), 0.6, 1.8);
    gl_PointSize = max(aSize * zoom * uPixelRatio, 1.0);

    float twinkle = 0.82 + 0.18 * sin(uTime * (0.4 + aSeed * 2.2) + aSeed * 97.0);
    vIntensity = aBrightness * twinkle * revealAt(position, uReveal, 135.0);
    vColor = aColor;
  }
`;

export const dustFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(vColor * exp(-r2 * 4.0) * vIntensity, 1.0);
  }
`;

// ── Distant sky (fixed pixel size, far away) ────────────────────────────────

export const skyVertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;

  attribute float aSize;
  attribute vec3 aColor;
  attribute float aBrightness;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    vIntensity = aBrightness * (0.75 + 0.25 * sin(uTime * (0.3 + aSeed) + aSeed * 50.0));
    vColor = aColor;
  }
`;

// ── Nebulae & core glow (camera-facing quads, instanced) ────────────────────

export const nebulaVertexShader = /* glsl */ `
  uniform float uReveal;

  attribute vec3 aCenter;
  attribute float aScale;
  attribute vec3 aColor;
  attribute float aIntensity;
  attribute float aSeed;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vSeed;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(aCenter, 1.0);
    mvPosition.xy += position.xy * aScale;
    gl_Position = projectionMatrix * mvPosition;
    vUv = position.xy;
    vColor = aColor;
    vSeed = aSeed;
    // Fade clouds the camera is inside of, rather than filling the screen.
    float distanceToCamera = length(mvPosition.xyz);
    vIntensity = aIntensity * uReveal * smoothstep(aScale * 0.35, aScale * 1.4, distanceToCamera);
  }
`;

export const nebulaFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vSeed;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float r2 = dot(vUv, vUv);
    if (r2 > 1.0) discard;
    float falloff = max(exp(-r2 * 3.2) - exp(-3.2), 0.0);
    vec2 q = vUv * 2.3 + vSeed * 17.0;
    float n = 0.55 * noise(q) + 0.3 * noise(q * 2.1 + 3.7) + 0.15 * noise(q * 4.3 + 9.1);
    gl_FragColor = vec4(vColor * falloff * (0.45 + n) * vIntensity, 1.0);
  }
`;

// ── Selection reticle & neighbor rings ──────────────────────────────────────

export const ringVertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uViewportHeight;
  uniform float uAppear;
  uniform float uPadding;

  attribute float aSize;
  attribute float aStrength;

  varying float vRing;
  varying float vPixel;
  varying float vStrength;

  ${STAR_SIZE}

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float starPx = aSize * starZoomScale(pixelsPerUnit(-mvPosition.z, uViewportHeight));
    float ringRadius = starPx * 0.3 + uPadding;
    float spriteRadius = (ringRadius + 12.0) * mix(1.4, 1.0, uAppear);
    gl_PointSize = spriteRadius * 2.0 * uPixelRatio;
    vRing = ringRadius / spriteRadius;
    vPixel = 1.0 / spriteRadius;
    vStrength = aStrength;
  }
`;

export const ringFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAppear;
  uniform float uTicks;
  uniform vec3 uColor;

  varying float vRing;
  varying float vPixel;
  varying float vStrength;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ring = 1.0 - smoothstep(0.35 * vPixel, 1.35 * vPixel, abs(r - vRing));

    // Four short ticks just outside the ring, slowly turning: a telescope reticle.
    float angle = atan(p.y, p.x) + uTime * 0.22;
    float fromAxis = abs(mod(angle + 0.785398, 1.570796) - 0.785398) * r;
    float along = step(vRing + 3.0 * vPixel, r) * step(r, vRing + 9.0 * vPixel);
    float tick = uTicks * along * (1.0 - smoothstep(0.4 * vPixel, 1.4 * vPixel, fromAxis));

    float alpha = max(ring * 0.85, tick) * uAppear * vStrength;
    gl_FragColor = vec4(uColor * alpha, 1.0);
  }
`;

// ── Constellation lines (Show Similar) ──────────────────────────────────────

export const lineVertexShader = /* glsl */ `
  attribute float aT;
  attribute float aStrength;
  varying float vT;
  varying float vStrength;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vT = aT;
    vStrength = aStrength;
  }
`;

export const lineFragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uColor;
  varying float vT;
  varying float vStrength;

  void main() {
    if (vT > uProgress) discard;
    // Brightest at the anchor, fading towards each neighbor.
    float alpha = mix(0.55, 0.14, vT) * vStrength;
    gl_FragColor = vec4(uColor * alpha, 1.0);
  }
`;
