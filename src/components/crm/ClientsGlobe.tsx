import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Globe, X, MapPin, Building2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Client {
  id: string;
  name: string;
  company: string;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
  value?: number;
  status?: 'active' | 'prospect' | 'won';
}

interface ClientsGlobeProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
}

// City coordinates database
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Colombia
  'cartagena': { lat: 10.3910, lng: -75.4794 },
  'bogota': { lat: 4.7110, lng: -74.0721 },
  'medellin': { lat: 6.2442, lng: -75.5812 },
  'barranquilla': { lat: 10.9685, lng: -74.7813 },
  'cali': { lat: 3.4516, lng: -76.5320 },
  // USA
  'miami': { lat: 25.7617, lng: -80.1918 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  // Europe
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  // Latin America
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'lima': { lat: -12.0464, lng: -77.0428 },
  'santiago': { lat: -33.4489, lng: -70.6693 },
  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  // Australia
  'sydney': { lat: -33.8688, lng: 151.2093 },
};

export default function ClientsGlobe({ clients, onClientClick }: ClientsGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredClient, setHoveredClient] = useState<Client | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Convert clients to locations with coordinates
  const clientLocations = useMemo(() => {
    return clients.map(client => {
      const cityKey = client.location?.city?.toLowerCase() || '';
      const coords = CITY_COORDINATES[cityKey] || { lat: client.location?.lat || 0, lng: client.location?.lng || 0 };
      return {
        ...client,
        coords
      };
    }).filter(c => c.coords.lat !== 0 || c.coords.lng !== 0);
  }, [clients]);

  useEffect(() => {
    if (!containerRef.current || !isExpanded) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Globe group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Create dotted globe
    const radius = 1;
    const dots: THREE.Vector3[] = [];

    // Generate dots for land masses
    const landCoordinates = generateLandCoordinates();

    landCoordinates.forEach((coord) => {
      const phi = (90 - coord.lat) * (Math.PI / 180);
      const theta = (coord.lng + 180) * (Math.PI / 180);

      const x = -radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      dots.push(new THREE.Vector3(x, y, z));
    });

    // Create points geometry
    const dotsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dots.length * 3);
    const colors = new Float32Array(dots.length * 3);

    dots.forEach((dot, i) => {
      positions[i * 3] = dot.x;
      positions[i * 3 + 1] = dot.y;
      positions[i * 3 + 2] = dot.z;

      // Color gradient based on position
      const color = new THREE.Color();
      color.setHSL(0.55 + dot.y * 0.1, 0.7, 0.5);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    dotsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dotsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const dotsMaterial = new THREE.PointsMaterial({
      size: 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const dotsSphere = new THREE.Points(dotsGeometry, dotsMaterial);
    globeGroup.add(dotsSphere);

    // Create atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.12, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.4, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphere);

    // Inner sphere
    const innerGeometry = new THREE.SphereGeometry(radius * 0.98, 64, 64);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.9,
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    globeGroup.add(innerSphere);

    // Client points and connections
    const clientPointsGroup = new THREE.Group();
    globeGroup.add(clientPointsGroup);
    const arcsGroup = new THREE.Group();
    globeGroup.add(arcsGroup);

    // Store point data for raycasting
    const pointsData: { mesh: THREE.Mesh; client: Client }[] = [];

    // Create client points
    clientLocations.forEach((client) => {
      const phi = (90 - client.coords.lat) * (Math.PI / 180);
      const theta = (client.coords.lng + 180) * (Math.PI / 180);

      const x = -radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      // Point group
      const pointGroup = new THREE.Group();
      pointGroup.position.set(x, y, z);

      // Core point
      const coreSize = client.status === 'won' ? 0.025 : client.status === 'active' ? 0.02 : 0.015;
      const coreGeometry = new THREE.SphereGeometry(coreSize, 16, 16);
      const coreColor = client.status === 'won' ? 0x22c55e : client.status === 'active' ? 0x3b82f6 : 0xf59e0b;
      const coreMaterial = new THREE.MeshBasicMaterial({ color: coreColor });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      pointGroup.add(core);

      // Glow
      const glowGeometry = new THREE.SphereGeometry(coreSize * 2, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 0.3,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      pointGroup.add(glow);

      // Pulse ring
      const ringGeometry = new THREE.RingGeometry(coreSize * 1.5, coreSize * 2, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      pointGroup.add(ring);

      clientPointsGroup.add(pointGroup);
      pointsData.push({ mesh: core, client });
    });

    // Create arcs from Cartagena to clients
    const cartagenaCoords = CITY_COORDINATES['cartagena'];
    clientLocations.forEach((client, index) => {
      if (client.location?.city?.toLowerCase() === 'cartagena') return;

      const arc = createArc(cartagenaCoords, client.coords, radius, index);
      arcsGroup.add(arc);
    });

    // Mouse interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let targetRotationY = 0;
    let targetRotationX = 0.2; // Slight tilt
    let autoRotate = true;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      autoRotate = false;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycasting for hover
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        pointsData.map((p) => p.mesh),
        false
      );

      if (intersects.length > 0) {
        const point = pointsData.find((p) => p.mesh === intersects[0].object);
        if (point) {
          setHoveredClient(point.client);
          setTooltipPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredClient(null);
        renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab';
      }

      if (!isDragging) return;

      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y,
      };

      targetRotationY += deltaMove.x * 0.005;
      targetRotationX += deltaMove.y * 0.005;
      targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
      setTimeout(() => {
        autoRotate = true;
      }, 3000);
    };

    const onClick = (e: MouseEvent) => {
      if (!containerRef.current || !onClientClick) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        pointsData.map((p) => p.mesh),
        false
      );

      if (intersects.length > 0) {
        const point = pointsData.find((p) => p.mesh === intersects[0].object);
        if (point) {
          onClientClick(point.client);
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);
    renderer.domElement.addEventListener('click', onClick);

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      isDragging = true;
      autoRotate = false;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const deltaMove = {
        x: e.touches[0].clientX - previousMousePosition.x,
        y: e.touches[0].clientY - previousMousePosition.y,
      };

      targetRotationY += deltaMove.x * 0.005;
      targetRotationX += deltaMove.y * 0.005;
      targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchmove', onTouchMove);
    renderer.domElement.addEventListener('touchend', onMouseUp);

    // Animation
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.01;

      if (autoRotate) {
        targetRotationY += 0.001;
      }

      globeGroup.rotation.y += (targetRotationY - globeGroup.rotation.y) * 0.05;
      globeGroup.rotation.x += (targetRotationX - globeGroup.rotation.x) * 0.05;

      // Animate arcs
      arcsGroup.children.forEach((arc) => {
        if ((arc as THREE.Line).material && 'uniforms' in (arc as THREE.Line).material) {
          ((arc as THREE.Line).material as THREE.ShaderMaterial).uniforms.time.value = time;
        }
      });

      // Pulse client points
      clientPointsGroup.children.forEach((group, i) => {
        const ring = group.children[2] as THREE.Mesh;
        if (ring) {
          const scale = 1 + Math.sin(time * 2 + i * 0.5) * 0.3;
          ring.scale.set(scale, scale, 1);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 - Math.sin(time * 2 + i * 0.5) * 0.2;
        }
      });

      renderer.render(scene, camera);
    };

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    setIsLoaded(true);
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mouseleave', onMouseUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onMouseUp);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isExpanded, clientLocations, onClientClick]);

  function createArc(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    radius: number,
    index: number
  ): THREE.Line {
    const startPhi = (90 - from.lat) * (Math.PI / 180);
    const startTheta = (from.lng + 180) * (Math.PI / 180);
    const endPhi = (90 - to.lat) * (Math.PI / 180);
    const endTheta = (to.lng + 180) * (Math.PI / 180);

    const start = new THREE.Vector3(
      -radius * Math.sin(startPhi) * Math.cos(startTheta),
      radius * Math.cos(startPhi),
      radius * Math.sin(startPhi) * Math.sin(startTheta)
    );

    const end = new THREE.Vector3(
      -radius * Math.sin(endPhi) * Math.cos(endTheta),
      radius * Math.cos(endPhi),
      radius * Math.sin(endPhi) * Math.sin(endTheta)
    );

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    mid.normalize().multiplyScalar(radius + distance * 0.35);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: index * 0.3 },
        color1: { value: new THREE.Color(0x3b82f6) },
        color2: { value: new THREE.Color(0x22c55e) },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec3 vPosition;
        void main() {
          vec3 color = mix(color1, color2, sin(time) * 0.5 + 0.5);
          float alpha = 0.5 + sin(time * 2.0) * 0.2;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Line(geometry, material);
  }

  function generateLandCoordinates(): { lat: number; lng: number }[] {
    const coords: { lat: number; lng: number }[] = [];

    // North America
    for (let lat = 25; lat <= 70; lat += 3) {
      for (let lng = -170; lng <= -50; lng += 4) {
        if (isLandNA(lat, lng)) coords.push({ lat, lng });
      }
    }

    // South America
    for (let lat = -55; lat <= 15; lat += 3) {
      for (let lng = -80; lng <= -35; lng += 4) {
        if (isLandSA(lat, lng)) coords.push({ lat, lng });
      }
    }

    // Europe
    for (let lat = 35; lat <= 70; lat += 3) {
      for (let lng = -10; lng <= 60; lng += 4) {
        if (isLandEU(lat, lng)) coords.push({ lat, lng });
      }
    }

    // Africa
    for (let lat = -35; lat <= 35; lat += 3) {
      for (let lng = -20; lng <= 50; lng += 4) {
        if (isLandAF(lat, lng)) coords.push({ lat, lng });
      }
    }

    // Asia
    for (let lat = 10; lat <= 75; lat += 3) {
      for (let lng = 60; lng <= 180; lng += 4) {
        if (isLandAS(lat, lng)) coords.push({ lat, lng });
      }
    }

    // Australia
    for (let lat = -45; lat <= -10; lat += 3) {
      for (let lng = 110; lng <= 155; lng += 4) {
        if (isLandAU(lat, lng)) coords.push({ lat, lng });
      }
    }

    return coords;
  }

  function isLandNA(lat: number, lng: number): boolean {
    if (lat > 48 && lng < -100) return lng > -170;
    if (lat > 30 && lat < 50 && lng > -130 && lng < -65) return true;
    if (lat > 15 && lat < 35 && lng > -120 && lng < -80) return true;
    return false;
  }

  function isLandSA(lat: number, lng: number): boolean {
    if (lat > -10 && lng > -80 && lng < -50) return true;
    if (lat > -25 && lat < -5 && lng > -75 && lng < -35) return true;
    if (lat > -40 && lat < -20 && lng > -70 && lng < -45) return true;
    if (lat > -55 && lat < -40 && lng > -75 && lng < -65) return true;
    return false;
  }

  function isLandEU(lat: number, lng: number): boolean {
    if (lat > 35 && lat < 72 && lng > -10 && lng < 40) return true;
    return false;
  }

  function isLandAF(lat: number, lng: number): boolean {
    if (lat > -35 && lat < 35 && lng > -20 && lng < 50) {
      const centerLng = 20;
      const width = 30 + (35 - Math.abs(lat)) * 0.8;
      if (Math.abs(lng - centerLng) < width) return true;
    }
    return false;
  }

  function isLandAS(lat: number, lng: number): boolean {
    if (lat > 20 && lat < 75 && lng > 60 && lng < 180) return true;
    if (lat > 10 && lat < 25 && lng > 90 && lng < 110) return true;
    return false;
  }

  function isLandAU(lat: number, lng: number): boolean {
    if (lat > -40 && lat < -12 && lng > 115 && lng < 150) return true;
    return false;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsExpanded(true)}
        className="gap-2"
      >
        <Globe className="h-4 w-4" />
        Ver Mapa Global de Clientes
      </Button>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800">
      {/* Background stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(80)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              opacity: Math.random() * 0.5 + 0.1,
              animationDuration: Math.random() * 3 + 2 + 's',
              animationDelay: Math.random() * 2 + 's',
            }}
          />
        ))}
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-20 text-white hover:bg-white/10"
        onClick={() => setIsExpanded(false)}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Title */}
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-400" />
          Mapa Global de Clientes
        </h3>
        <p className="text-xs text-slate-400 mt-1">{clientLocations.length} clientes en el mapa</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-slate-300">Ganados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-300">Activos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-slate-300">Prospectos</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 text-xs text-slate-500">
        Arrastra para rotar
      </div>

      {/* Globe container */}
      <div
        ref={containerRef}
        className="relative w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />

      {/* Tooltip */}
      {hoveredClient && (
        <div
          ref={tooltipRef}
          className="absolute z-30 pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px]">
            <div className="flex items-start gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-white text-sm">{hoveredClient.company}</p>
                <p className="text-xs text-slate-400">{hoveredClient.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <MapPin className="h-3 w-3" />
              {hoveredClient.location?.city}, {hoveredClient.location?.country}
            </div>
            {hoveredClient.value && (
              <div className="flex items-center gap-2 text-xs text-green-400 mt-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(hoveredClient.value)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {!isLoaded && isExpanded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
