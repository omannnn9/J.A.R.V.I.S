"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildHead } from "@/lib/head/buildHead";
import type { AvatarState } from "@/lib/avatarState";

const STATE_COLOR: Record<AvatarState, number> = {
  asleep: 0x3a4a52,
  idle: 0x35d0c8,
  listening: 0x37e08a,
  thinking: 0x35d0c8,
  speaking: 0x35d0c8,
};

export function HeadModel({ state }: { state: AvatarState }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const head = buildHead();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.05, 8.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const wireGeom = new THREE.BufferGeometry();
    wireGeom.setAttribute("position", new THREE.BufferAttribute(head.edgePositions, 3));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x2fb8c9,
      transparent: true,
      opacity: 0.55,
    });
    const wireframe = new THREE.LineSegments(wireGeom, wireMat);
    scene.add(wireframe);

    function eyeMesh(pos: [number, number, number]) {
      const geo = new THREE.SphereGeometry(0.045, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: STATE_COLOR.idle });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2] + 0.02);

      const glowGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: STATE_COLOR.idle,
        transparent: true,
        opacity: 0.35,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      mesh.add(glow);
      return { mesh, mat, glowMat };
    }

    const eyeL = eyeMesh(head.eyeL);
    const eyeR = eyeMesh(head.eyeR);
    scene.add(eyeL.mesh, eyeR.mesh);

    const group = new THREE.Group();
    group.add(wireframe, eyeL.mesh, eyeR.mesh);
    scene.add(group);

    let raf = 0;
    let t = 0;
    let nextBlinkAt = 2 + Math.random() * 3;
    let blinkStart: number | null = null;
    const BLINK_DURATION = 0.16;

    function resize() {
      if (!mount) return;
      const w = mount.clientWidth || 300;
      const h = mount.clientHeight || 300;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    function animate() {
      raf = requestAnimationFrame(animate);
      t += 0.016;
      const s = stateRef.current;

      const breathe = s === "asleep" ? 1 : 1 + Math.sin(t * 0.7) * 0.012;
      group.scale.setScalar(breathe);
      group.rotation.y = Math.sin(t * 0.18) * 0.12;
      group.rotation.x = Math.sin(t * 0.13) * 0.03;

      const color = STATE_COLOR[s];
      const pulse =
        s === "thinking"
          ? 0.6 + Math.sin(t * 6) * 0.4
          : s === "speaking"
            ? 0.7 + Math.abs(Math.sin(t * 14)) * 0.3
            : s === "listening"
              ? 0.85 + Math.sin(t * 3) * 0.15
              : 0.7;

      for (const eye of [eyeL, eyeR]) {
        eye.mat.color.setHex(color);
        eye.glowMat.color.setHex(color);
        eye.glowMat.opacity = s === "asleep" ? 0.08 : 0.25 + pulse * 0.25;
      }
      wireMat.color.setHex(s === "asleep" ? 0x203038 : 0x2fb8c9);
      wireMat.opacity = s === "asleep" ? 0.25 : 0.5;

      // blink: a short triangular pulse that closes the eyes once every few seconds
      let eyeScale = 1;
      if (s === "asleep") {
        eyeScale = 0.35;
      } else {
        if (blinkStart === null && t > nextBlinkAt) blinkStart = t;
        if (blinkStart !== null) {
          const progress = (t - blinkStart) / BLINK_DURATION;
          if (progress >= 1) {
            blinkStart = null;
            nextBlinkAt = t + 2.5 + Math.random() * 4;
          } else {
            eyeScale = 1 - (1 - Math.abs(progress - 0.5) * 2) * 0.85;
          }
        }
      }
      eyeL.mesh.scale.setScalar(Math.max(0.15, eyeScale));
      eyeR.mesh.scale.setScalar(Math.max(0.15, eyeScale));

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wireGeom.dispose();
      wireMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
