"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useGalaxyStore } from "@/store/galaxyStore";
import { getStarBuffers } from "./starBuffers";
import { getStarProjection, pickStar } from "./starProjection";

const MOUSE_REACH = 9;
const TOUCH_REACH = 20;
const CLICK_SLOP = 6;
const CLICK_MAX_MS = 650;

/**
 * Hover and click on repository stars via screen-space picking. A press that
 * moves more than a few pixels is a drag (camera control), never a click.
 */
export function PointerInteraction() {
  const gl = useThree((s) => s.gl);
  const dataset = useGalaxyStore((s) => s.dataset);
  const buffers = useMemo(() => getStarBuffers(dataset), [dataset]);

  const pointer = useRef({
    x: 0,
    y: 0,
    inside: false,
    touch: false,
    dragging: false,
    down: null as null | { x: number; y: number; time: number },
  });

  useEffect(() => {
    const element = gl.domElement;
    const state = pointer.current;
    const local = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMove = (event: PointerEvent) => {
      const { x, y } = local(event);
      state.x = x;
      state.y = y;
      state.inside = true;
      state.touch = event.pointerType === "touch";
      if (state.down && !state.dragging && Math.hypot(x - state.down.x, y - state.down.y) > CLICK_SLOP) {
        state.dragging = true;
        element.style.cursor = "grabbing";
      }
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const { x, y } = local(event);
      state.down = { x, y, time: performance.now() };
      state.dragging = false;
      state.touch = event.pointerType === "touch";
    };

    const onUp = (event: PointerEvent) => {
      const down = state.down;
      const wasDrag = state.dragging;
      state.down = null;
      state.dragging = false;
      element.style.cursor = "";
      if (!down || wasDrag || performance.now() - down.time > CLICK_MAX_MS) return;

      const { x, y } = local(event);
      const touch = event.pointerType === "touch";
      const hit = pickStar(getStarProjection(buffers), buffers, x, y, touch ? TOUCH_REACH : MOUSE_REACH);
      const store = useGalaxyStore.getState();
      if (hit >= 0) store.select(hit, "center");
      else if (store.selectedIndex >= 0) store.select(-1);
    };

    const onCancel = () => {
      state.down = null;
      state.dragging = false;
      element.style.cursor = "";
    };

    const onLeave = () => {
      state.inside = false;
      useGalaxyStore.getState().hover(-1);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onCancel);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onCancel);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, buffers]);

  // Re-pick every frame: stars glide under a still cursor while the camera eases.
  useFrame(() => {
    const state = pointer.current;
    const store = useGalaxyStore.getState();
    if (!state.inside || state.touch || state.dragging) {
      if (store.hoveredIndex !== -1) store.hover(-1);
      return;
    }
    if (state.down) return;
    const hit = pickStar(getStarProjection(buffers), buffers, state.x, state.y, MOUSE_REACH);
    store.hover(hit);
    gl.domElement.style.cursor = hit >= 0 ? "pointer" : "grab";
  });

  return null;
}
