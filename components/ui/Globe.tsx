"use client";
import { useEffect, useRef, useState } from "react";
import { Color, Scene, Fog, PerspectiveCamera, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { useThree, Object3DNode, Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";
declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: Object3DNode<ThreeGlobe, typeof ThreeGlobe>;
  }
}

extend({ ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;

type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

export type GlobeConfig = {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  initialPosition?: {
    lat: number;
    lng: number;
  };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

let numbersOfRings = [0];

export function Globe({ globeConfig, data }: WorldProps) {
  const [globeData, setGlobeData] = useState<
    | {
        size: number;
        order: number;
        color: (t: number) => string;
        lat: number;
        lng: number;
      }[]
    | null
  >(null);
  const [isReady, setIsReady] = useState(false);

  const globeRef = useRef<ThreeGlobe | null>(null);

  const defaultProps = {
    pointSize: 1,
    atmosphereColor: "#ffffff",
    showAtmosphere: true,
    atmosphereAltitude: 0.1,
    polygonColor: "rgba(255,255,255,0.7)",
    globeColor: "#1d072e",
    emissive: "#000000",
    emissiveIntensity: 0.1,
    shininess: 0.9,
    arcTime: 2000,
    arcLength: 0.9,
    rings: 1,
    maxRings: 3,
    ambientLight: "#ffffff",
    directionalLeftLight: "#ffffff",
    directionalTopLight: "#ffffff",
    pointLight: "#ffffff",
    autoRotate: true,
    autoRotateSpeed: 1,
    ...globeConfig,
  };

  useEffect(() => {
    if (globeRef.current && data && data.length > 0) {
      _buildData();
      _buildMaterial();
    }
  }, [globeRef.current, data]);

  const _buildMaterial = () => {
    if (!globeRef.current) return;

    const globeMaterial = globeRef.current.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
    };
    try {
      globeMaterial.color = new Color(defaultProps.globeColor || "#1d072e");
      globeMaterial.emissive = new Color(defaultProps.emissive || "#000000");
      globeMaterial.emissiveIntensity = defaultProps.emissiveIntensity || 0.1;
      globeMaterial.shininess = defaultProps.shininess || 0.9;
    } catch (error) {
      console.warn("Error setting globe material:", error);
    }
  };

  const _buildData = () => {
    if (!data || data.length === 0) return;
    const arcs = data;
    let points = [];
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      // Validate all coordinates are valid numbers
      const startLat = Number(arc.startLat);
      const startLng = Number(arc.startLng);
      const endLat = Number(arc.endLat);
      const endLng = Number(arc.endLng);
      
      if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
        continue;
      }
      
      const rgb = hexToRgb(arc.color) || { r: 0, g: 255, b: 255 };
      const colorStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
      points.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        colorStr: colorStr,
        lat: startLat,
        lng: startLng,
      });
      points.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        colorStr: colorStr,
        lat: endLat,
        lng: endLng,
      });
    }

    // remove duplicates for same lat and lng
    const filteredPoints = points.filter(
      (v, i, a) =>
        a.findIndex((v2) =>
          ["lat", "lng"].every(
            (k) => v2[k as "lat" | "lng"] === v[k as "lat" | "lng"]
          )
        ) === i
    );

    setGlobeData(filteredPoints);
  };

  useEffect(() => {
    if (globeRef.current && globeData) {
      try {
        globeRef.current
          .hexPolygonsData(countries.features)
          .hexPolygonResolution(3)
          .hexPolygonMargin(0.7)
          .showAtmosphere(defaultProps.showAtmosphere)
          .atmosphereColor(defaultProps.atmosphereColor || "#ffffff")
          .atmosphereAltitude(defaultProps.atmosphereAltitude || 0.1)
          .hexPolygonColor((e) => {
            return defaultProps.polygonColor || "rgba(255,255,255,0.7)";
          });
        startAnimation();
        setIsReady(true);
      } catch (error) {
        console.warn("Error setting up globe polygons:", error);
      }
    }
  }, [globeData]);

  const startAnimation = () => {
    if (!globeRef.current || !globeData || !data || data.length === 0) return;
    
    // Validate that we have at least some point data
    if (globeData.length === 0) {
      console.warn("No valid globe data points available");
      return;
    }

    try {
      globeRef.current
        .arcsData(data)
        .arcStartLat((d) => {
          const lat = (d as { startLat: number }).startLat * 1;
          return isNaN(lat) ? 0 : lat;
        })
        .arcStartLng((d) => {
          const lng = (d as { startLng: number }).startLng * 1;
          return isNaN(lng) ? 0 : lng;
        })
        .arcEndLat((d) => {
          const lat = (d as { endLat: number }).endLat * 1;
          return isNaN(lat) ? 0 : lat;
        })
        .arcEndLng((d) => {
          const lng = (d as { endLng: number }).endLng * 1;
          return isNaN(lng) ? 0 : lng;
        })
        .arcColor((e: any) => {
          const color = (e as { color: string }).color;
          return color || "#06b6d4";
        })
        .arcAltitude((e) => {
          const alt = (e as { arcAlt: number }).arcAlt * 1;
          return isNaN(alt) ? 0.1 : alt;
        })
        .arcStroke((e) => {
          return [0.32, 0.28, 0.3][Math.round(Math.random() * 2)];
        })
        .arcDashLength(defaultProps.arcLength || 0.9)
        .arcDashInitialGap((e) => {
          const order = (e as { order: number }).order * 1;
          return isNaN(order) ? 0 : order;
        })
        .arcDashGap(15)
        .arcDashAnimateTime((e) => defaultProps.arcTime || 2000);

      globeRef.current
        .pointsData(globeData)
        .pointColor((e) => {
          const colorStr = (e as any).colorStr;
          return colorStr || "#06b6d4";
        })
        .pointsMerge(true)
        .pointAltitude(0.0)
        .pointRadius(2);

      globeRef.current
        .ringsData([])
        .ringColor((e: any) => (t: any) => {
          const colorFunc = e.color;
          if (typeof colorFunc === 'function') {
            return colorFunc(t);
          }
          return "rgba(255, 0, 255, 1)";
        })
        .ringMaxRadius(defaultProps.maxRings || 3)
        .ringPropagationSpeed(RING_PROPAGATION_SPEED)
        .ringRepeatPeriod(
          ((defaultProps.arcTime || 2000) * (defaultProps.arcLength || 0.9)) / (defaultProps.rings || 1)
        );
    } catch (error) {
      console.warn("Error during animation setup:", error);
    }
  };

  useEffect(() => {
    if (!globeRef.current || !globeData || !data || data.length === 0 || !isReady) return;

    const interval = setInterval(() => {
      if (!globeRef.current || !globeData || !data || data.length === 0) return;
      try {
        const ringCount = Math.floor((data.length * 4) / 5);
        if (ringCount > 0) {
          numbersOfRings = genRandomNumbers(
            0,
            data.length,
            ringCount
          );

          globeRef.current.ringsData(
            globeData.filter((d, i) => numbersOfRings.includes(i))
          );
        }
      } catch (error) {
        console.warn("Error updating rings:", error);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [globeRef.current, globeData, data, isReady]);

  return (
    <>
      {globeRef && <threeGlobe ref={globeRef} />}
    </>
  );
}

export function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0xffaaff, 0);
  }, []);

  return null;
}

export function World(props: WorldProps) {
  const { globeConfig } = props;
  const scene = new Scene();
  scene.fog = new Fog(0xffffff, 400, 2000);
  
  // Ensure all config colors have valid defaults
  const safeConfig = {
    ...globeConfig,
    ambientLight: globeConfig.ambientLight || "#ffffff",
    directionalLeftLight: globeConfig.directionalLeftLight || "#ffffff",
    directionalTopLight: globeConfig.directionalTopLight || "#ffffff",
    pointLight: globeConfig.pointLight || "#ffffff",
  };
  
  return (
    <Canvas scene={scene} camera={new PerspectiveCamera(50, aspect, 180, 1800)}>
      <WebGLRendererConfig />
      <ambientLight color={safeConfig.ambientLight} intensity={0.6} />
      <directionalLight
        color={safeConfig.directionalLeftLight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={safeConfig.directionalTopLight}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={safeConfig.pointLight}
        position={new Vector3(-200, 500, 200)}
        intensity={0.8}
      />
      <Globe {...props} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={cameraZ}
        maxDistance={cameraZ}
        autoRotateSpeed={1}
        autoRotate={true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}

export function hexToRgb(hex: string) {
  // Return fallback if hex is not provided
  if (!hex || typeof hex !== 'string') {
    return { r: 0, g: 255, b: 255 };
  }
  
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    // Validate that the parsed values are valid numbers
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return { r, g, b };
    }
  }
  
  return { r: 0, g: 255, b: 255 };
}

export function genRandomNumbers(min: number, max: number, count: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(count)) {
    return [];
  }
  
  if (count <= 0 || min >= max) {
    return [];
  }
  
  const arr = [];
  const maxAttempts = Math.max(count * 10, 1000);
  let attempts = 0;
  
  while (arr.length < count && attempts < maxAttempts) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (arr.indexOf(r) === -1) arr.push(r);
    attempts++;
  }

  return arr;
}
