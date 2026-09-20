"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildHead, JAW_MAX, JAW_PIVOT, LIPS_IN } from "@/lib/head/buildHead";
import { lipSyncState, tickLipSync } from "@/lib/head/lipSyncBus";
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

    // Mouth cavity — a filled fan over the inner lip ring. A wireframe jaw
    // drop alone is too subtle a line-thickness change to read at HUD size;
    // this is the wireframe equivalent of the desktop app's own reasoning
    // for filling the mouth: "the single cheapest thing that makes an open
    // mouth look like speech." Faded in from nothing, scaled by openness.
    const cavityVertCount = LIPS_IN.length + 1;
    const cavityCentroidIdx = LIPS_IN.length;
    const cavityPositions = new Float32Array(cavityVertCount * 3);
    const cavityIndex: number[] = [];
    for (let i = 0; i < LIPS_IN.length; i++) {
      const next = (i + 1) % LIPS_IN.length;
      cavityIndex.push(cavityCentroidIdx, i, next);
    }
    const cavityGeom = new THREE.BufferGeometry();
    cavityGeom.setAttribute("position", new THREE.BufferAttribute(cavityPositions, 3));
    cavityGeom.setIndex(cavityIndex);
    const cavityMat = new THREE.MeshBasicMaterial({
      color: 0x0c3236,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    const cavityMesh = new THREE.Mesh(cavityGeom, cavityMat);

    // Bright rim on the same ring — a crisp edge around the cavity reads far
    // better at this size than the fill alone.
    const rimPositions = new Float32Array(LIPS_IN.length * 3);
    const rimGeom = new THREE.BufferGeometry();
    rimGeom.setAttribute("position", new THREE.BufferAttribute(rimPositions, 3));
    const rimMat = new THREE.LineBasicMaterial({ color: 0x6ff0e8, transparent: true, opacity: 0 });
    const rimLoop = new THREE.LineLoop(rimGeom, rimMat);

    const group = new THREE.Group();
    group.add(wireframe, cavityMesh, rimLoop, eyeL.mesh, eyeR.mesh);
    scene.add(group);

    let raf = 0;
    let t = 0;
    let lastTime = performance.now();
    let nextBlinkAt = 2 + Math.random() * 3;
    let blinkStart: number | null = null;
    const BLINK_DURATION = 0.16;

    const totalVerts = head.positions.length / 3;
    const deformed = new Float32Array(head.positions.length);
    const edgeCount = head.edgeIndices.length / 2;

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

    const posAttr = wireGeom.attributes.position as THREE.BufferAttribute;
    const [, py, pz] = JAW_PIVOT; // jaw pivot's x is unused — the rotation only swings in y/z

    // Deform the mouth region for this frame's (mouth openness, lip
    // spread/round) and rebuild the wireframe's edge buffer from it — same
    // two-step rig as avatar_mesh.py's `_pose()`: lip spread/round first,
    // then the jaw rotation (which reads the already lip-shifted position).
    function applyMouth(mouth: number, wide: number) {
      deformed.set(head.positions);

      if (Math.abs(wide) > 0.01 && mouth > 0) {
        for (let i = 0; i < totalVerts; i++) {
          const k = head.lipWeight[i] * (wide * mouth);
          if (k === 0) continue;
          const x = deformed[i * 3];
          const y = deformed[i * 3 + 1];
          deformed[i * 3] = x + k * (x - head.lipCentre[0]) * 0.55;
          deformed[i * 3 + 1] = y + k * (y - head.lipCentre[1]) * 0.3;
          deformed[i * 3 + 2] -= k * 0.055;
        }
      }

      if (mouth > 0.004) {
        for (let i = 0; i < totalVerts; i++) {
          const jw = head.jawWeight[i];
          if (jw === 0) continue;
          const ang = jw * (mouth * JAW_MAX);
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const dy = deformed[i * 3 + 1] - py;
          const dz = deformed[i * 3 + 2] - pz;
          deformed[i * 3 + 1] = py + dy * ca - dz * sa;
          deformed[i * 3 + 2] = pz + dy * sa + dz * ca;
        }
      }

      for (let e = 0; e < edgeCount; e++) {
        const a = head.edgeIndices[e * 2];
        const b = head.edgeIndices[e * 2 + 1];
        posAttr.array[e * 6] = deformed[a * 3];
        posAttr.array[e * 6 + 1] = deformed[a * 3 + 1];
        posAttr.array[e * 6 + 2] = deformed[a * 3 + 2];
        posAttr.array[e * 6 + 3] = deformed[b * 3];
        posAttr.array[e * 6 + 4] = deformed[b * 3 + 1];
        posAttr.array[e * 6 + 5] = deformed[b * 3 + 2];
      }
      posAttr.needsUpdate = true;

      let cx = 0,
        cy = 0,
        cz = 0;
      for (let i = 0; i < LIPS_IN.length; i++) {
        const vi = LIPS_IN[i];
        const x = deformed[vi * 3];
        const y = deformed[vi * 3 + 1];
        const z = deformed[vi * 3 + 2] - 0.02; // tucked just behind the lip ring
        cavityPositions[i * 3] = x;
        cavityPositions[i * 3 + 1] = y;
        cavityPositions[i * 3 + 2] = z;
        rimPositions[i * 3] = x;
        rimPositions[i * 3 + 1] = y;
        rimPositions[i * 3 + 2] = z + 0.01;
        cx += x;
        cy += y;
        cz += z;
      }
      cavityPositions[cavityCentroidIdx * 3] = cx / LIPS_IN.length;
      cavityPositions[cavityCentroidIdx * 3 + 1] = cy / LIPS_IN.length;
      cavityPositions[cavityCentroidIdx * 3 + 2] = cz / LIPS_IN.length;
      (cavityGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (rimGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      cavityMat.opacity = Math.min(0.88, mouth * 1.15);
      rimMat.opacity = Math.min(0.9, mouth * 1.3);
    }

    function animate() {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.max(0.001, Math.min(0.1, (now - lastTime) / 1000));
      lastTime = now;
      t += dt;
      const s = stateRef.current;

      tickLipSync(now, dt);
      applyMouth(lipSyncState.mouth, lipSyncState.wide);

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
      cavityGeom.dispose();
      cavityMat.dispose();
      rimGeom.dispose();
      rimMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
