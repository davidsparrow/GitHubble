"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ViewMode } from "@/lib/types";
import { useGalaxyStore, type CameraIntent } from "@/store/galaxyStore";
import { TOP_CHROME_HEIGHT } from "../layoutMetrics";
import { prefersReducedMotion } from "./sceneEnvironment";

/*
 * One perspective camera serves both views. Telescope orbits the galaxy at an
 * oblique angle; Above the Plane looks straight down through a narrow field of
 * view, which is close enough to orthographic to read as a map while letting
 * the switch between them animate as a single continuous camera move.
 *
 * Camera moves are expressed as poses: a target, the visible half-height at
 * that target, polar/azimuth angles and a field of view. Interpolating the
 * visible half-height (not distance) keeps zoom perceptually smooth while the
 * field of view changes.
 */

export const TELESCOPE_FOV = 50;
const ABOVE_FOV = 22;
/** ~57° from straight down: an oblique, telescope-like vantage on wide screens… */
const TELESCOPE_PHI = 1.0;
/** …and a steeper one on tall screens, where a tilted disc would waste the height. */
const TELESCOPE_PHI_PORTRAIT = 0.66;
/** Straight down (OrbitControls needs to stay a hair off the pole). */
const ABOVE_PHI = 0.0008;
const HOME_THETA = 0.35;
const IDLE_DRIFT_AFTER_MS = 20_000;
const MODE_SWITCH_MS = 1500;

type Pose = { target: THREE.Vector3; halfHeight: number; phi: number; theta: number; fov: number };

/**
 * The part of the canvas the galaxy can actually use (not under the header,
 * search suggestions or repository card): its aspect ratio, and how much taller
 * the whole canvas is than that area.
 */
type Viewport = { aspect: number; scale: number };

function telescopePhi(aspect: number): number {
  return THREE.MathUtils.lerp(TELESCOPE_PHI_PORTRAIT, TELESCOPE_PHI, THREE.MathUtils.clamp((aspect - 0.55) / 0.65, 0, 1));
}

type Tween = {
  from: Pose;
  to: Pose;
  start: number;
  duration: number;
  /** Extra zoom-out mid-flight for long trips, so you see where you're going. */
  hop: number;
  ease: (t: number) => number;
  interruptible: boolean;
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const tanHalf = (fov: number) => Math.tan(THREE.MathUtils.degToRad(fov) / 2);
const shortestAngle = (delta: number) => Math.atan2(Math.sin(delta), Math.cos(delta));

const scratchOffset = new THREE.Vector3();
const scratchSpherical = new THREE.Spherical();

function readPose(camera: THREE.PerspectiveCamera, target: THREE.Vector3): Pose {
  scratchSpherical.setFromVector3(scratchOffset.copy(camera.position).sub(target));
  return {
    target: target.clone(),
    halfHeight: scratchSpherical.radius * tanHalf(camera.fov),
    phi: scratchSpherical.phi,
    theta: scratchSpherical.theta,
    fov: camera.fov,
  };
}

function applyPose(camera: THREE.PerspectiveCamera, controls: OrbitControls, pose: Pose) {
  scratchOffset.setFromSphericalCoords(pose.halfHeight / tanHalf(pose.fov), pose.phi, pose.theta);
  camera.position.copy(pose.target).add(scratchOffset);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(pose.target);
  controls.target.copy(pose.target);
}

function interpolatePose(tween: Tween, e: number): Pose {
  const { from, to, hop } = tween;
  const halfHeight =
    Math.exp(THREE.MathUtils.lerp(Math.log(from.halfHeight), Math.log(to.halfHeight), e)) * (1 + hop * Math.sin(Math.PI * e));
  return {
    target: new THREE.Vector3().lerpVectors(from.target, to.target, e),
    halfHeight,
    phi: THREE.MathUtils.lerp(from.phi, to.phi, e),
    theta: THREE.MathUtils.lerp(from.theta, to.theta, e),
    fov: THREE.MathUtils.lerp(from.fov, to.fov, e),
  };
}

/** OrbitControls keeps drag inertia in private fields; clear it so it can't fight a tween. */
function resetMomentum(controls: OrbitControls) {
  const internals = controls as unknown as {
    _sphericalDelta?: THREE.Spherical;
    _panOffset?: THREE.Vector3;
    _scale?: number;
  };
  internals._sphericalDelta?.set(0, 0, 0);
  internals._panOffset?.set(0, 0, 0);
  if (typeof internals._scale === "number") internals._scale = 1;
}

/** The whole galaxy, framed for a view and the free viewport. */
function overviewPose(mode: ViewMode, viewport: Viewport, extent: number, theta: number): Pose {
  const radius = extent + 10;
  const { aspect, scale } = viewport;
  if (mode === "above") {
    return {
      target: new THREE.Vector3(),
      halfHeight: Math.max(radius, radius / aspect) * 1.04 * scale,
      phi: ABOVE_PHI,
      theta,
      fov: ABOVE_FOV,
    };
  }
  // A tilted disc is ~cos(phi) as tall as it is wide. Perspective makes the near
  // half loom larger, so also aim a little towards the viewer. Tall screens let
  // the outermost arms run slightly off the sides rather than shrink the galaxy.
  const phi = telescopePhi(aspect);
  const widthFit = THREE.MathUtils.lerp(0.92, 1.1, THREE.MathUtils.clamp((aspect - 0.5) / 0.7, 0, 1));
  return {
    target: new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)).multiplyScalar(radius * 0.14),
    halfHeight: Math.max(radius * (0.36 + 0.8 * Math.cos(phi)), (radius * widthFit) / aspect) * scale,
    phi,
    theta,
    fov: TELESCOPE_FOV,
  };
}

function distanceLimits(mode: ViewMode, viewport: Viewport, extent: number) {
  const overview = overviewPose(mode, viewport, extent, 0);
  const overviewDistance = overview.halfHeight / tanHalf(overview.fov);
  return mode === "telescope" ? { min: 5, max: overviewDistance * 2.4 } : { min: 45, max: overviewDistance * 1.6 };
}

function constrainPose(pose: Pose, mode: ViewMode, viewport: Viewport, extent: number): Pose {
  const { min, max } = distanceLimits(mode, viewport, extent);
  const scale = tanHalf(pose.fov);
  return { ...pose, halfHeight: THREE.MathUtils.clamp(pose.halfHeight, min * scale, max * scale) };
}

function configureControls(controls: OrbitControls, mode: ViewMode, viewport: Viewport, extent: number) {
  const { min, max } = distanceLimits(mode, viewport, extent);
  controls.minDistance = min;
  controls.maxDistance = max;
  if (mode === "telescope") {
    controls.enableRotate = true;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.9;
    controls.zoomToCursor = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  } else {
    controls.enableRotate = false;
    controls.minPolarAngle = ABOVE_PHI;
    controls.maxPolarAngle = ABOVE_PHI;
    controls.zoomToCursor = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  }
}

export function GalaxyCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const extent = useGalaxyStore((s) => s.dataset.extent);

  const controlsRef = useRef<OrbitControls | null>(null);
  const tweenRef = useRef<Tween | null>(null);
  const viewOffset = useRef({ x: 0, y: 0 });
  const lastInteraction = useRef(0);

  const freeViewport = (): Viewport => {
    const { size } = get();
    const { cardInset, searchInset } = useGalaxyStore.getState();
    const freeWidth = Math.max(1, size.width - cardInset.right);
    const freeHeight = Math.max(80, size.height - TOP_CHROME_HEIGHT - searchInset - cardInset.bottom);
    return { aspect: Math.max(0.2, freeWidth / freeHeight), scale: size.height / freeHeight };
  };

  const finishTween = () => {
    const controls = controlsRef.current;
    tweenRef.current = null;
    if (!controls) return;
    configureControls(controls, useGalaxyStore.getState().viewMode, freeViewport(), extent);
    controls.enabled = true;
    resetMomentum(controls);
    controls.update();
  };

  const startTween = (
    destination: Pose,
    options: { duration?: number; ease?: (t: number) => number; interruptible?: boolean } = {},
  ) => {
    const controls = controlsRef.current;
    if (!controls) return;
    resetMomentum(controls);
    const from = readPose(camera, controls.target);
    const to = { ...destination, theta: from.theta + shortestAngle(destination.theta - from.theta) };
    const travel = from.target.distanceTo(to.target);
    const visible = Math.max(from.halfHeight, to.halfHeight);
    const duration =
      options.duration ?? THREE.MathUtils.clamp(900 + 380 * Math.log2(1 + travel / visible), 800, 2200);
    controls.enabled = false;
    tweenRef.current = {
      from,
      to,
      start: performance.now(),
      duration: prefersReducedMotion() ? 1 : duration,
      hop: THREE.MathUtils.clamp((travel / visible - 1) * 0.35, 0, 1.2),
      ease: options.ease ?? easeInOutCubic,
      interruptible: options.interruptible ?? true,
    };
  };

  // Controls, intro flight and interrupt handling.
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.9;
    controls.maxTargetRadius = extent + 25;
    controlsRef.current = controls;
    lastInteraction.current = performance.now();

    const viewport = freeViewport();
    configureControls(controls, "telescope", viewport, extent);
    const home = overviewPose("telescope", viewport, extent, HOME_THETA);
    if (prefersReducedMotion()) {
      applyPose(camera, controls, home);
      controls.update();
    } else {
      // Glide in from deep space while the stars ignite.
      applyPose(camera, controls, { ...home, halfHeight: home.halfHeight * 3.4, phi: 1.34, theta: HOME_THETA - 1.1 });
      startTween(home, { duration: 3600, ease: easeOutCubic });
    }

    // Grabbing the view cancels an in-flight camera move (capture phase: before OrbitControls sees the event).
    const host = gl.domElement.parentElement ?? gl.domElement;
    const onInteract = () => {
      lastInteraction.current = performance.now();
      if (tweenRef.current?.interruptible) finishTween();
    };
    host.addEventListener("pointerdown", onInteract, { capture: true });
    host.addEventListener("wheel", onInteract, { capture: true, passive: true });

    return () => {
      host.removeEventListener("pointerdown", onInteract, { capture: true });
      host.removeEventListener("wheel", onInteract, { capture: true });
      controls.dispose();
      controlsRef.current = null;
      tweenRef.current = null;
    };
    // The camera rig is created once per camera/renderer; helpers read live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, extent]);

  // Keep distance limits in step with the viewport.
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls && !tweenRef.current) {
      configureControls(controls, useGalaxyStore.getState().viewMode, freeViewport(), extent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, extent]);

  // React to view switches and camera intents from the UI.
  useEffect(() => {
    const onIntent = (intent: CameraIntent, mode: ViewMode) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const { repositories } = useGalaxyStore.getState().dataset;
      const current = readPose(camera, controls.target);
      const viewport = freeViewport();
      const fov = mode === "telescope" ? TELESCOPE_FOV : ABOVE_FOV;
      const phi = (lo: number, hi: number) => (mode === "telescope" ? THREE.MathUtils.clamp(current.phi, lo, hi) : ABOVE_PHI);

      if (intent.kind === "overview") {
        startTween(overviewPose(mode, viewport, extent, current.theta));
        return;
      }

      if (intent.kind === "focus") {
        const repo = repositories[intent.index];
        const halfHeight =
          intent.style === "fly"
            ? mode === "telescope" ? 13 : 30
            : Math.min(current.halfHeight, mode === "telescope" ? 70 : 120);
        startTween(
          constrainPose(
            { target: new THREE.Vector3(repo.x, repo.y, repo.z), halfHeight, phi: phi(0.6, 1.3), theta: current.theta, fov },
            mode,
            viewport,
            extent,
          ),
        );
        return;
      }

      const points = intent.indices.map((i) => repositories[i]);
      const center = new THREE.Vector3(
        points.reduce((sum, r) => sum + r.x, 0) / points.length,
        points.reduce((sum, r) => sum + r.y, 0) / points.length,
        points.reduce((sum, r) => sum + r.z, 0) / points.length,
      );
      if (intent.anchor !== undefined) {
        // Show Similar: keep the anchor near the middle of its neighborhood.
        const anchor = repositories[intent.anchor];
        center.lerp(new THREE.Vector3(anchor.x, anchor.y, anchor.z), 0.5);
      }
      const distances = points.map((r) => center.distanceTo(new THREE.Vector3(r.x, r.y, r.z))).sort((a, b) => a - b);
      const farthest = distances[distances.length - 1];
      // Show Similar zooms to the heart of the neighborhood (outliers may sit at the
      // edge, their constellation lines leading to them); other sets fit entirely.
      const radius =
        (intent.anchor !== undefined
          ? Math.max(farthest * 0.6, distances[Math.floor((distances.length - 1) * 0.75)])
          : farthest) + 6;
      const halfHeight = Math.max(mode === "telescope" ? 12 : 25, radius * 1.15 * Math.max(1, 1 / viewport.aspect) * viewport.scale);
      // A neighborhood reads best from higher up, where it spreads across the screen rather than into depth.
      const tilt = intent.anchor !== undefined ? phi(0.5, 0.8) : phi(0.75, 1.15);
      startTween(constrainPose({ target: center, halfHeight, phi: tilt, theta: current.theta, fov }, mode, viewport, extent));
    };

    const onViewMode = (mode: ViewMode) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const current = readPose(camera, controls.target);
      const viewport = freeViewport();
      // Looking down shows a little more context than the telescope did, up to the whole map.
      const map = overviewPose("above", viewport, extent, current.theta);
      const destination: Pose =
        mode === "above"
          ? { ...current, halfHeight: Math.min(Math.max(current.halfHeight * 1.3, 30), map.halfHeight), phi: ABOVE_PHI, fov: ABOVE_FOV }
          : { ...current, phi: telescopePhi(viewport.aspect), fov: TELESCOPE_FOV };
      startTween(constrainPose(destination, mode, viewport, extent), { duration: MODE_SWITCH_MS, interruptible: false });
    };

    return useGalaxyStore.subscribe((state, prev) => {
      if (state.viewMode !== prev.viewMode) onViewMode(state.viewMode);
      if (state.cameraIntent && state.cameraIntent !== prev.cameraIntent) onIntent(state.cameraIntent, state.viewMode);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, extent]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const tween = tweenRef.current;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
      applyPose(camera, controls, interpolatePose(tween, tween.ease(t)));
      if (t >= 1) finishTween();
    } else {
      const store = useGalaxyStore.getState();
      controls.autoRotate =
        !prefersReducedMotion() &&
        store.viewMode === "telescope" &&
        store.selectedIndex < 0 &&
        store.similarAnchorIndex < 0 &&
        performance.now() - lastInteraction.current > IDLE_DRIFT_AFTER_MS;
      controls.autoRotateSpeed = 0.12;
      controls.update(delta);
    }

    // Shift the projection so the point of interest sits in the middle of the
    // free viewport: below the header and any open search suggestions, beside
    // the repository card (desktop) or above the bottom sheet (mobile).
    const { cardInset, searchInset } = useGalaxyStore.getState();
    const offset = viewOffset.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 5);
    offset.x += (cardInset.right / 2 - offset.x) * k;
    offset.y += ((cardInset.bottom - TOP_CHROME_HEIGHT - searchInset) / 2 - offset.y) * k;
    const { width: w, height: h } = state.size;
    camera.setViewOffset(w, h, offset.x, offset.y, w, h);

    camera.updateMatrixWorld();
  }, -2);

  return null;
}
