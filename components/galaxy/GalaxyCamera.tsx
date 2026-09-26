"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ViewMode } from "@/lib/types";
import { useGalaxyStore, type CameraIntent } from "@/store/galaxyStore";
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
/** ~57° from straight down: an oblique, telescope-like vantage. */
const TELESCOPE_PHI = 1.0;
/** Straight down (OrbitControls needs to stay a hair off the pole). */
const ABOVE_PHI = 0.0008;
const HOME_THETA = 0.35;
const IDLE_DRIFT_AFTER_MS = 20_000;
const MODE_SWITCH_MS = 1500;

type Pose = { target: THREE.Vector3; halfHeight: number; phi: number; theta: number; fov: number };

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

/** The whole galaxy, framed for a view and an aspect ratio. */
function overviewPose(mode: ViewMode, aspect: number, extent: number, theta: number): Pose {
  const radius = extent + 10;
  if (mode === "above") {
    return {
      target: new THREE.Vector3(),
      halfHeight: Math.max(radius, radius / aspect) * 1.04,
      phi: ABOVE_PHI,
      theta,
      fov: ABOVE_FOV,
    };
  }
  // Perspective makes the near half of the disc loom larger, so aim a little
  // towards the viewer to keep the whole spiral in frame.
  return {
    target: new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)).multiplyScalar(radius * 0.08),
    halfHeight: Math.max(radius * 0.8, (radius * 1.1) / aspect),
    phi: TELESCOPE_PHI,
    theta,
    fov: TELESCOPE_FOV,
  };
}

function distanceLimits(mode: ViewMode, aspect: number, extent: number) {
  const overview = overviewPose(mode, aspect, extent, 0);
  const overviewDistance = overview.halfHeight / tanHalf(overview.fov);
  return mode === "telescope" ? { min: 5, max: overviewDistance * 2.4 } : { min: 45, max: overviewDistance * 1.6 };
}

function constrainPose(pose: Pose, mode: ViewMode, aspect: number, extent: number): Pose {
  const { min, max } = distanceLimits(mode, aspect, extent);
  const scale = tanHalf(pose.fov);
  return { ...pose, halfHeight: THREE.MathUtils.clamp(pose.halfHeight, min * scale, max * scale) };
}

function configureControls(controls: OrbitControls, mode: ViewMode, aspect: number, extent: number) {
  const { min, max } = distanceLimits(mode, aspect, extent);
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

  // Aspect ratio of the area not covered by the repository card.
  const freeAspect = () => {
    const { size } = get();
    const inset = useGalaxyStore.getState().cardInset;
    return Math.max(0.2, (size.width - inset.right) / Math.max(1, size.height - inset.bottom));
  };

  const finishTween = () => {
    const controls = controlsRef.current;
    tweenRef.current = null;
    if (!controls) return;
    configureControls(controls, useGalaxyStore.getState().viewMode, freeAspect(), extent);
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

    const { size } = get();
    const aspect = size.width / Math.max(1, size.height);
    configureControls(controls, "telescope", aspect, extent);
    const home = overviewPose("telescope", aspect, extent, HOME_THETA);
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
      configureControls(controls, useGalaxyStore.getState().viewMode, width / Math.max(1, height), extent);
    }
  }, [width, height, extent]);

  // React to view switches and camera intents from the UI.
  useEffect(() => {
    const onIntent = (intent: CameraIntent, mode: ViewMode) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const { repositories } = useGalaxyStore.getState().dataset;
      const current = readPose(camera, controls.target);
      const aspect = freeAspect();
      const fov = mode === "telescope" ? TELESCOPE_FOV : ABOVE_FOV;
      const phi = (lo: number, hi: number) => (mode === "telescope" ? THREE.MathUtils.clamp(current.phi, lo, hi) : ABOVE_PHI);

      if (intent.kind === "overview") {
        startTween(overviewPose(mode, aspect, extent, current.theta));
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
            aspect,
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
      const radius = points.reduce((max, r) => Math.max(max, center.distanceTo(new THREE.Vector3(r.x, r.y, r.z))), 0) + 6;
      const halfHeight = Math.max(mode === "telescope" ? 12 : 25, radius * 1.15 * Math.max(1, 1 / aspect));
      startTween(constrainPose({ target: center, halfHeight, phi: phi(0.75, 1.15), theta: current.theta, fov }, mode, aspect, extent));
    };

    const onViewMode = (mode: ViewMode) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const current = readPose(camera, controls.target);
      const destination: Pose =
        mode === "above"
          ? { ...current, halfHeight: Math.max(current.halfHeight, 30), phi: ABOVE_PHI, fov: ABOVE_FOV }
          : { ...current, phi: TELESCOPE_PHI, fov: TELESCOPE_FOV };
      startTween(constrainPose(destination, mode, freeAspect(), extent), { duration: MODE_SWITCH_MS, interruptible: false });
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
    // area the repository card leaves free (right panel on desktop, sheet on mobile).
    const inset = useGalaxyStore.getState().cardInset;
    const offset = viewOffset.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 5);
    offset.x += (inset.right / 2 - offset.x) * k;
    offset.y += (inset.bottom / 2 - offset.y) * k;
    if (inset.right === 0 && inset.bottom === 0 && Math.abs(offset.x) < 0.25 && Math.abs(offset.y) < 0.25) {
      offset.x = 0;
      offset.y = 0;
      if (camera.view?.enabled) camera.clearViewOffset();
    } else {
      const { width: w, height: h } = state.size;
      camera.setViewOffset(w, h, offset.x, offset.y, w, h);
    }

    camera.updateMatrixWorld();
  }, -2);

  return null;
}
