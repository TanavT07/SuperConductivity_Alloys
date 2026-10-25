"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Polymorph } from '../types/materials';
import { Move, ZoomIn, RotateCcw, Camera } from 'lucide-react';

export interface CrystalViewer3DProps {
  polymorph: Polymorph | null;
}

const ELEMENT_COLORS: Record<string, string> = {
  H: '#FFFFFF', He: '#D9FFFF', Li: '#CC80FF', Be: '#C2FF00', B: '#FFB5B5',
  C: '#909090', N: '#3050F8', O: '#FF0D0D', F: '#90E050', Ne: '#B3E3F5',
  Na: '#AB5CF2', Mg: '#8AFF00', Al: '#BFA6A6', Si: '#F0C8A0', P: '#FF8000',
  S: '#FFFF30', Cl: '#1FF01F', Ar: '#80D1E3', K: '#8F40D4', Ca: '#3DFF00',
  Sc: '#E6E6E6', Ti: '#BFC2C7', V: '#A6A6AB', Cr: '#8A99C7', Mn: '#9C7AC7',
  Fe: '#E06633', Co: '#F090A0', Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0',
  Ga: '#C28F8F', Ge: '#668F8F', As: '#BD80E3', Se: '#FFA100', Br: '#A62929',
  Kr: '#5CB8D1', Rb: '#702EB0', Sr: '#00FF00', Y: '#94FFFF', Zr: '#94E0E0',
  Nb: '#73C2C9', Mo: '#54B5B5', Tc: '#3B9E9E', Ru: '#248F8F', Rh: '#0A7D8C',
  Pd: '#006985', Ag: '#C0C0C0', Cd: '#FFD98F', In: '#A67573', Sn: '#668080',
  Sb: '#9E63B5', Te: '#D47A00', I: '#940094', Xe: '#429EB0', Cs: '#57178F',
  Ba: '#00C900', La: '#70D4FF', Ce: '#FFFFC7', Pr: '#D9FFC7', Nd: '#C7FFC7',
  Pm: '#A3FFC7', Sm: '#8FFFC7', Eu: '#61FFC7', Gd: '#45FFC7', Tb: '#30FFC7',
  Dy: '#1FFFC7', Ho: '#00FF9C', Er: '#00E675', Tm: '#00D452', Yb: '#00BF38',
  Lu: '#00AB24', Hf: '#4DC2FF', Ta: '#4DA6FF', W: '#2194D6', Re: '#267DAB',
  Os: '#266696', Ir: '#175487', Pt: '#D0D0E0', Au: '#FFD123', Hg: '#B8B8D0',
  Tl: '#A6544D', Pb: '#575961', Bi: '#9E4FB5', Po: '#AB5C00', At: '#754F45',
  Rn: '#428296', Fr: '#420066', Ra: '#007D00', Ac: '#70ABFA', Th: '#00BAFF',
  Pa: '#00A1FF', U: '#008FFF', Np: '#0080FF', Pu: '#006BFF',
};

const ELEMENT_RADII: Record<string, number> = {
  H: 0.25, He: 0.31, Li: 0.45, Be: 0.38, B: 0.36, C: 0.35, N: 0.34,
  O: 0.33, F: 0.32, Na: 0.50, Mg: 0.45, Al: 0.43, Si: 0.42, P: 0.40,
  S: 0.39, Cl: 0.38, K: 0.55, Ca: 0.50, Ti: 0.46, V: 0.44, Cr: 0.43,
  Mn: 0.43, Fe: 0.42, Co: 0.41, Ni: 0.40, Cu: 0.40, Zn: 0.42,
  Ga: 0.41, Ge: 0.40, As: 0.40, Se: 0.40, Br: 0.40, Sr: 0.50,
  Y: 0.48, Zr: 0.46, Nb: 0.45, Mo: 0.44, Ru: 0.42, Rh: 0.42,
  Pd: 0.42, Ag: 0.44, Cd: 0.46, In: 0.44, Sn: 0.44, Sb: 0.44,
  Te: 0.44, I: 0.44, Ba: 0.55, La: 0.52, Ce: 0.52, Nd: 0.50,
  Sm: 0.50, Eu: 0.50, Gd: 0.49, Tb: 0.49, Dy: 0.49, Ho: 0.48,
  Er: 0.48, Yb: 0.48, Lu: 0.47, Hf: 0.46, Ta: 0.45, W: 0.44,
  Re: 0.43, Os: 0.42, Ir: 0.42, Pt: 0.42, Au: 0.42, Pb: 0.47,
  Bi: 0.46, U: 0.50,
};

export const CrystalViewer3D = ({ polymorph }: CrystalViewer3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const crystalGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xf8fafc, 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-5, -3, -5);
    scene.add(dirLight2);

    // Grid floor
    const grid = new THREE.GridHelper(10, 10, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = -0.01;
    scene.add(grid);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update crystal when polymorph changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    // Remove old crystal
    if (crystalGroupRef.current) {
      scene.remove(crystalGroupRef.current);
      crystalGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      crystalGroupRef.current = null;
    }

    if (!polymorph || !polymorph.sites || polymorph.sites.length === 0) return;

    const group = new THREE.Group();
    const lattice = polymorph.lattice;

    // Convert fractional coordinates to Cartesian
    const toCartesian = (frac: [number, number, number]): THREE.Vector3 => {
      const a = lattice.a;
      const b = lattice.b;
      const c = lattice.c;
      const alpha = (lattice.alpha * Math.PI) / 180;
      const beta = (lattice.beta * Math.PI) / 180;
      const gamma = (lattice.gamma * Math.PI) / 180;

      const cosAlpha = Math.cos(alpha);
      const cosBeta = Math.cos(beta);
      const cosGamma = Math.cos(gamma);
      const sinGamma = Math.sin(gamma);

      const x = a * frac[0] + b * cosGamma * frac[1] + c * cosBeta * frac[2];
      const y = b * sinGamma * frac[1] + c * ((cosAlpha - cosBeta * cosGamma) / sinGamma) * frac[2];
      const val = 1 - cosBeta * cosBeta - ((cosAlpha - cosBeta * cosGamma) / sinGamma) ** 2;
      const z = c * Math.sqrt(Math.max(0, val)) * frac[2];

      return new THREE.Vector3(x, y, z);
    };

    // Draw atoms
    const atomPositions: THREE.Vector3[] = [];
    const atomElements: string[] = [];

    polymorph.sites.forEach((site) => {
      const pos = toCartesian(site.coords);
      atomPositions.push(pos);
      atomElements.push(site.element);

      const radius = (ELEMENT_RADII[site.element] || 0.4) * 0.6;
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const color = ELEMENT_COLORS[site.element] || '#CCCCCC';
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        shininess: 80,
        specular: 0x444444,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      group.add(mesh);
    });

    // Draw bonds between nearby atoms
    const bondMaterial = new THREE.MeshPhongMaterial({
      color: 0x94a3b8,
      shininess: 30,
    });

    for (let i = 0; i < atomPositions.length; i++) {
      for (let j = i + 1; j < atomPositions.length; j++) {
        const dist = atomPositions[i].distanceTo(atomPositions[j]);
        if (dist > 0.5 && dist < 3.0) {
          const start = atomPositions[i];
          const end = atomPositions[j];
          const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
          const direction = new THREE.Vector3().subVectors(end, start);
          const length = direction.length();

          const geometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
          geometry.translate(0, length / 2, 0);
          geometry.rotateX(Math.PI / 2);

          const mesh = new THREE.Mesh(geometry, bondMaterial);
          mesh.position.copy(start);
          mesh.lookAt(end);
          group.add(mesh);
        }
      }
    }

    // Draw unit cell wireframe
    const corners: [number, number, number][] = [
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
      [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    ];
    const cartCorners = corners.map(toCartesian);
    const edges: [number, number][] = [
      [0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 4],
      [2, 6], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7],
    ];

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 });
    edges.forEach(([a, b]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([cartCorners[a], cartCorners[b]]);
      const line = new THREE.Line(geometry, lineMaterial);
      group.add(line);
    });

    // Center the group
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);

    scene.add(group);
    crystalGroupRef.current = group;

    // Fit camera
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fitDistance = maxDim * 2.2;
    camera.position.set(fitDistance * 0.7, fitDistance * 0.5, fitDistance * 0.7);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [polymorph]);

  const handleResetView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(8, 6, 8);
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  const handleZoomFit = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const group = crystalGroupRef.current;
    if (!camera || !controls || !group) return;

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fitDist = maxDim * 2.0;
    camera.position.set(fitDist * 0.7, fitDist * 0.5, fitDist * 0.7);
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  const handleSnapshot = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `crystal_${polymorph?.formula || 'structure'}.png`;
    link.href = dataUrl;
    link.click();
  }, [polymorph]);

  return (
    <div className="relative h-full min-h-[360px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="w-full h-full crystal-canvas-container" />

      {/* Toolbar overlay */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        {[
          { icon: <Move className="w-3.5 h-3.5" />, action: () => {}, title: 'Pan mode' },
          { icon: <ZoomIn className="w-3.5 h-3.5" />, action: handleZoomFit, title: 'Zoom to fit' },
          { icon: <RotateCcw className="w-3.5 h-3.5" />, action: handleResetView, title: 'Reset view' },
          { icon: <Camera className="w-3.5 h-3.5" />, action: handleSnapshot, title: 'Capture snapshot' },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            title={btn.title}
            className="w-8 h-8 bg-white/90 backdrop-blur border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white transition-colors shadow-sm"
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Polymorph selector toolbar (left side) */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <button
          title="Perspective view"
          className="w-8 h-8 bg-white/90 backdrop-blur border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z" /></svg>
        </button>
      </div>

      {/* Info overlay */}
      {polymorph ? (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-500">Formula</span>
            <span className="font-mono font-semibold text-emerald-600">{polymorph.formula}</span>
            <span className="text-slate-500">Space Group</span>
            <span className="font-mono text-slate-700">{polymorph.space_group.symbol} ({polymorph.space_group.number})</span>
            <span className="text-slate-500">System</span>
            <span className="font-mono text-slate-700 capitalize">{polymorph.crystal_system}</span>
            <span className="text-slate-500">Volume</span>
            <span className="font-mono text-slate-700">{polymorph.lattice.volume.toFixed(2)} ų</span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-slate-400 font-mono text-sm">Select a polymorph to visualize</span>
        </div>
      )}
    </div>
  );
};

export default CrystalViewer3D;
