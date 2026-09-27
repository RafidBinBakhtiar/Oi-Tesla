'use client';

import { ContactShadows, Float, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';

const ROAD_RADIUS = 2.35;
const ROAD_WIDTH = 0.9;
const ISLAND_RADIUS = 3.6;

const PALETTE = {
  ground: '#e9e4dc',
  grass: '#bfd8a8',
  road: '#3b3835',
  lane: '#f4efe6',
  buildings: ['#f3d9c4', '#d9e4ee', '#f1e2b8', '#e7d3e3', '#cfe3d6', '#f6cfc9'],
  window: '#9fb8c9',
  brand: '#e0213d',
  body: '#fbfaf8',
  glass: '#1d2733',
  tyre: '#1a1a1a',
  trunk: '#8a6a4a',
  leaf: '#6fae5e',
};

// Car's local +x is "forward". Heading along a CCW circle at angle a: rotation.y = -a - π/2.
function Tesla({ color = PALETTE.body }: { color?: string }) {
  const wheels: [number, number][] = [
    [0.36, 0.2],
    [0.36, -0.2],
    [-0.36, 0.2],
    [-0.36, -0.2],
  ];
  return (
    <group>
      <RoundedBox args={[1.12, 0.22, 0.5]} radius={0.09} smoothness={4} position={[0, 0.2, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.15} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.2, 0.44]} radius={0.09} smoothness={4} position={[-0.05, 0.36, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.glass} roughness={0.08} metalness={0.6} />
      </RoundedBox>
      <mesh position={[0.565, 0.22, 0]}>
        <boxGeometry args={[0.02, 0.035, 0.38]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff6d8" emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[-0.565, 0.24, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.42]} />
        <meshStandardMaterial color={PALETTE.brand} emissive={PALETTE.brand} emissiveIntensity={1.6} />
      </mesh>
      {wheels.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.1, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.08, 20]} />
          <meshStandardMaterial color={PALETTE.tyre} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function DrivingCar({ speed, lane, offset, color }: { speed: number; lane: number; offset: number; color?: string }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const car = ref.current;
    if (!car) return;
    const a = offset + clock.getElapsedTime() * speed;
    car.position.set(Math.cos(a) * lane, 0.02, Math.sin(a) * lane);
    car.rotation.y = -a - Math.PI / 2;
  });
  return (
    <group ref={ref} scale={0.55}>
      <Tesla color={color} />
    </group>
  );
}

function Pin({ angle, delay }: { angle: number; delay: number }) {
  const ref = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const x = Math.cos(angle) * (ROAD_RADIUS + ROAD_WIDTH * 0.75);
  const z = Math.sin(angle) * (ROAD_RADIUS + ROAD_WIDTH * 0.75);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + delay;
    if (ref.current) {
      ref.current.position.y = 0.75 + Math.sin(t * 2) * 0.08;
      ref.current.rotation.y = t * 0.8;
    }
    if (ring.current) {
      const p = (t * 0.6) % 1;
      ring.current.scale.setScalar(0.4 + p * 1.4);
      (ring.current.material as { opacity: number }).opacity = 0.55 * (1 - p);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={ref}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshStandardMaterial color={PALETTE.brand} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.1, 0.26, 24]} />
          <meshStandardMaterial color={PALETTE.brand} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.18, 0.24, 40]} />
        <meshBasicMaterial color={PALETTE.brand} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Building({ x, z, w, d, h, color }: { x: number; z: number; w: number; d: number; h: number; color: string }) {
  const rows = Math.max(1, Math.floor(h / 0.28));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {Array.from({ length: rows }, (_, i) => (
        <mesh key={i} position={[0, 0.18 + i * 0.28, d / 2 + 0.002]}>
          <planeGeometry args={[w * 0.7, 0.1]} />
          <meshStandardMaterial color={PALETTE.window} roughness={0.2} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.24, 8]} />
        <meshStandardMaterial color={PALETTE.trunk} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <icosahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={PALETTE.leaf} flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}

function seeded(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function City() {
  const { buildings, trees } = useMemo(() => {
    const b: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const r = 1.1 + seeded(i) * 0.35;
      b.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        w: 0.34 + seeded(i + 10) * 0.2,
        d: 0.34 + seeded(i + 20) * 0.2,
        h: 0.5 + seeded(i + 30) * 1.3,
        color: PALETTE.buildings[i % PALETTE.buildings.length],
      });
    }
    const t: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = ROAD_RADIUS + ROAD_WIDTH * 0.5 + 0.35 + seeded(i + 40) * 0.5;
      if (i % 4 === 1) continue;
      t.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.8 + seeded(i + 50) * 0.5 });
    }
    return { buildings: b, trees: t };
  }, []);

  return (
    <group>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS * 0.94, 0.34, 64]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_RADIUS, 64]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <ringGeometry args={[ROAD_RADIUS - ROAD_WIDTH / 2, ROAD_RADIUS + ROAD_WIDTH / 2, 96]} />
        <meshStandardMaterial color={PALETTE.road} roughness={0.9} />
      </mesh>
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, -a]}
            position={[Math.cos(a) * ROAD_RADIUS, 0.008, Math.sin(a) * ROAD_RADIUS]}
          >
            <planeGeometry args={[0.03, 0.2]} />
            <meshBasicMaterial color={PALETTE.lane} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[ROAD_RADIUS - ROAD_WIDTH / 2, 64]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} />
      </mesh>
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  );
}

function Diorama({ animate }: { animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ pointer, clock }) => {
    const g = ref.current;
    if (!g) return;
    const spin = animate ? clock.getElapsedTime() * 0.06 : 0;
    g.rotation.y += (spin + pointer.x * 0.35 - g.rotation.y) * 0.05;
    g.rotation.x += (-pointer.y * 0.08 - g.rotation.x) * 0.05;
  });
  return (
    <group ref={ref}>
      <City />
      <DrivingCar speed={animate ? 0.45 : 0} lane={ROAD_RADIUS + 0.2} offset={0} />
      <DrivingCar speed={animate ? 0.45 : 0} lane={ROAD_RADIUS + 0.2} offset={Math.PI} color={PALETTE.brand} />
      <DrivingCar speed={animate ? -0.32 : 0} lane={ROAD_RADIUS - 0.2} offset={Math.PI / 2} color="#2b2f36" />
      <Pin angle={0.9} delay={0} />
      <Pin angle={2.9} delay={1.3} />
      <Pin angle={4.6} delay={2.1} />
    </group>
  );
}

export default function CityScene({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [7.6, 6, 7.6], fov: 34 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
    >
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#fff7ec', '#b9c6d6', 0.6]} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <Float speed={reducedMotion ? 0 : 1.4} rotationIntensity={0.08} floatIntensity={0.35}>
        <group position={[0, -0.4, 0]}>
          <Diorama animate={!reducedMotion} />
        </group>
      </Float>
      <ContactShadows position={[0, -1.1, 0]} opacity={0.35} scale={12} blur={2.6} far={3} />
    </Canvas>
  );
}
