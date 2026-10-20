import { Canvas } from "@react-three/fiber";
import { useAppState } from "../state/AppState.js";

// A fixed seed keeps the distant sky stable across renders and reloads.
function createStars(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let index = 0; index < count; index++) {
    const azimuth = random() * Math.PI * 2;
    const height = random() * 2 - 1;
    const radius = 90 + random() * 60;
    const ring = Math.sqrt(1 - height * height);
    const brightness = 0.35 + random() * 0.65;

    positions.set([
      Math.cos(azimuth) * ring * radius,
      height * radius,
      Math.sin(azimuth) * ring * radius,
    ], index * 3);
    colors.set([brightness * 0.85, brightness * 0.92, brightness], index * 3);
  }

  return { positions, colors };
}

const stars = createStars(2400);

function Scene() {
  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <points raycast={() => {}}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[stars.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}

export default function World() {
  const { selectNode } = useAppState();

  return (
    <div className="world">
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0, 7], fov: 50 }}
        onPointerMissed={() => selectNode(null)}
        fallback={<p>3D rendering requires WebGL. You can still use the menu.</p>}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
