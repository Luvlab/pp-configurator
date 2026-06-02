import React, { Suspense, useRef, useImperativeHandle, forwardRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';
import { Project, PlacedPart } from '../types';

export interface ViewerRef {
  captureSnapshot: () => string;
  exportModel: () => void;
}

interface ViewerProps {
  project: Project;
  placedParts: PlacedPart[];
  onSlotClick: (slotId: string) => void;
  selectedSlotId: string | null;
  onUpdatePart?: (slotId: string, key: string, value: any) => void;
}

const getGeneratedTexture = (type: 'textile' | 'felt'): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if(!ctx) return new THREE.Texture(); 

    ctx.fillStyle = '#808080'; 
    ctx.fillRect(0, 0, 512, 512);

    if (type === 'felt') {
        for(let i=0; i<100000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const opacity = Math.random() * 0.15;
            ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (type === 'textile') {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        for(let i=0; i<512; i+=4) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        for(let i=0; i<512; i+=4) {
             ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
        }
        for(let i=0; i<40000; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
            ctx.fillRect(Math.random()*512, Math.random()*512, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4); 
    
    return texture;
}

const textureCache: Record<string, THREE.Texture> = {};
const textureLoader = new THREE.TextureLoader();

const INTERNAL_MATERIALS = {
    metal: new THREE.MeshStandardMaterial({ color: '#C0C0C0', metalness: 0.9, roughness: 0.2, toneMapped: true }),
    glass: new THREE.MeshStandardMaterial({ color: '#E0F7FA', roughness: 0.0, metalness: 0.9, opacity: 0.3, transparent: true, side: THREE.DoubleSide, toneMapped: true }),
    handle: new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5, metalness: 0.8, toneMapped: true }),
    lockBase: new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.8, roughness: 0.2, toneMapped: true }),
    hole: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 1.0, metalness: 0.0 }) // Very dark hole
};

// Component to load external GLTF models
const ExternalPartModel = ({ url, material, position, rotation }: { url: string, material: THREE.MeshStandardMaterial, position?: THREE.Vector3, rotation?: THREE.Euler }) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => {
        const c = scene.clone();
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = true;
                (child as THREE.Mesh).receiveShadow = true;
                if (material) {
                     (child as THREE.Mesh).material = material;
                }
            }
        });
        return c;
    }, [scene, material]);

    return <primitive object={clonedScene} position={position} rotation={rotation} />;
};

const PartGeometry = React.memo(({ type, dimensions, material, position, rotation, modelUrl }: {
  type: string;
  dimensions: number[];
  material: THREE.MeshStandardMaterial;
  position?: [number, number, number];
  rotation?: [number, number, number];
  modelUrl?: string;
}) => {
  const meshRotation = useMemo(() => rotation ? new THREE.Euler(...rotation) : undefined, [rotation]);
  const pos = useMemo(() => position ? new THREE.Vector3(...position) : undefined, [position]);

  // Handle uploaded custom models
  if (modelUrl) {
      return (
          <Suspense fallback={<mesh position={pos}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="gray" wireframe /></mesh>}>
              <ExternalPartModel url={modelUrl} material={material} position={pos} rotation={meshRotation} />
          </Suspense>
      );
  }

  // Jewelry geometry types
  if (type === 'custom_H') {
    // Rectangular chain link — two capsule bars forming a ring
    const [w, h, d] = dimensions;
    const tube = d / 2;
    const rx = w / 2 - tube;
    const ry = h / 2 - tube;
    return (
      <group position={pos} rotation={meshRotation} castShadow>
        {/* Top bar */}
        <mesh position={[0, ry, 0]} castShadow receiveShadow material={material}>
          <capsuleGeometry args={[tube, rx * 2, 8, 12]} />
        </mesh>
        {/* Bottom bar */}
        <mesh position={[0, -ry, 0]} castShadow receiveShadow material={material}>
          <capsuleGeometry args={[tube, rx * 2, 8, 12]} />
        </mesh>
        {/* Left bar */}
        <mesh position={[-rx, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={material}>
          <capsuleGeometry args={[tube, ry * 2, 8, 12]} />
        </mesh>
        {/* Right bar */}
        <mesh position={[rx, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={material}>
          <capsuleGeometry args={[tube, ry * 2, 8, 12]} />
        </mesh>
      </group>
    );
  }

  if (type === 'gem_plus') {
    // Faceted gem — octahedron with slight vertical elongation
    const r = dimensions[0] / 2;
    return (
      <mesh position={pos} rotation={meshRotation} castShadow receiveShadow material={material}
            scale={[1, 1.3, 1]}>
        <octahedronGeometry args={[r, 0]} />
      </mesh>
    );
  }

  if (type === 'custom_lock') {
    return (
      <RoundedBox
        args={dimensions as [number, number, number]}
        radius={0.004}
        smoothness={4}
        position={pos}
        rotation={meshRotation}
        castShadow
        receiveShadow
        material={material}
      />
    );
  }

  // Fallback for Furniture primitives
  if (type === 'door_acoustic') {
      const [w, h, d] = dimensions;
      const winW = 0.4;
      const winH = 0.6;
      const winY = 0.4;
      return (
          <group position={pos} rotation={meshRotation}>
             <RoundedBox args={[w, h, d]} radius={0.02} smoothness={2} position={[0, 0, 0]} castShadow receiveShadow material={material} />
             <mesh position={[0, winY, 0]}>
                 <boxGeometry args={[winW, winH, d + 0.01]} />
                 <primitive object={INTERNAL_MATERIALS.glass} attach="material" />
             </mesh>
          </group>
      );
  }

  if (type === 'rounded_box') {
      return (
          <RoundedBox 
            args={dimensions as [number, number, number]} 
            radius={0.03} 
            smoothness={4} 
            position={pos}
            rotation={meshRotation}
            castShadow
            receiveShadow
            material={material}
          />
      );
  }

  return (
    <mesh position={pos} rotation={meshRotation} castShadow receiveShadow material={material}>
      {type === 'box' && <boxGeometry args={dimensions as [number, number, number]} />}
      {type === 'cylinder' && <cylinderGeometry args={dimensions as [number, number, number, number]} />}
      {type === 'sphere' && <sphereGeometry args={dimensions as [number, number, number]} />}
      {type === 'torus' && <torusGeometry args={dimensions as [number, number, number, number]} />}
    </mesh>
  );
});

const ScreenshotHandler = ({ captureRef }: { captureRef: React.MutableRefObject<() => string> }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = () => {
      const hiddenObjects: THREE.Object3D[] = [];
      scene.traverse((child) => {
        if (child.userData.isBackground) {
          if (child.visible) {
             child.visible = false;
             hiddenObjects.push(child);
          }
        }
      });
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');
      hiddenObjects.forEach(obj => obj.visible = true);
      gl.render(scene, camera);
      return dataUrl;
    };
  }, [gl, scene, camera, captureRef]);
  return null;
};

const CameraController = ({
    setFitCamera,
    modelRef,
}: {
    setFitCamera: (fn: () => void) => void,
    modelRef: React.RefObject<THREE.Group>,
}) => {
    const { camera, controls } = useThree();

    const fit = useCallback(() => {
             if (!modelRef.current) return;

             const box = new THREE.Box3().setFromObject(modelRef.current);
             let center = new THREE.Vector3(0, 0, 0);
             let sizeVector = new THREE.Vector3(2, 2, 2);

             if (!box.isEmpty()) {
                box.getCenter(center);
                box.getSize(sizeVector);
             }

             const maxDim = Math.max(sizeVector.x, sizeVector.y, sizeVector.z);
             const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
             const margin = 1.4;
             let dist = (maxDim / 2 / Math.tan(fov / 2)) * margin;

             const angle = Math.PI / 8;
             const camX = Math.sin(angle) * dist;
             const camZ = Math.cos(angle) * dist;
             const targetY = center.y + 0.3;

             camera.position.set(center.x + camX, targetY, center.z + camZ);
             camera.lookAt(new THREE.Vector3(center.x, targetY, center.z));

             if(controls) {
                // @ts-ignore
                controls.target.set(center.x, targetY, center.z);
                // @ts-ignore
                controls.update();
             }

             (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }, [camera, controls, modelRef]);

    useEffect(() => {
        setFitCamera(fit);
    }, [fit, setFitCamera]);

    // Initial fit with extended check
    useEffect(() => {
        const t1 = setTimeout(() => fit(), 200);
        const t2 = setTimeout(() => fit(), 500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [fit]);
    
    return null;
};

const Viewer3D = forwardRef<ViewerRef, ViewerProps>(({ project, placedParts, onSlotClick, selectedSlotId, onUpdatePart }, ref) => {
  const captureFnRef = useRef<() => string>(() => '');
  const fitCameraRef = useRef<() => void>(() => {});
  const modelGroupRef = useRef<THREE.Group>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  const handleSetFitCamera = useCallback((fn: () => void) => {
      fitCameraRef.current = fn;
  }, []);

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => captureFnRef.current(),
    exportModel: () => {
        if (!modelGroupRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(modelGroupRef.current, (gltf) => {
                const output = JSON.stringify(gltf, null, 2);
                const blob = new Blob([output], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `nexus_design_${Date.now()}.gltf`;
                link.click();
                URL.revokeObjectURL(url);
            },
            (error) => console.error('Export failed', error),
            { binary: false }
        );
    }
  }));
  
  const projectMaterials = useMemo(() => {
    const materials: Record<string, THREE.MeshStandardMaterial> = {};
    project.materialsLibrary.forEach(matData => {
        const matParams: THREE.MeshStandardMaterialParameters = {
            color: matData.color,
            roughness: matData.roughness,
            metalness: matData.metalness,
            transparent: matData.transparent || false,
            opacity: matData.opacity !== undefined ? matData.opacity : 1.0,
            side: matData.transparent ? THREE.DoubleSide : THREE.FrontSide,
            toneMapped: true
        };
        if (matData.textureUrl) {
            const tex = textureLoader.load(matData.textureUrl);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.encoding = THREE.sRGBEncoding;
            matParams.map = tex;
        } else if (matData.texture) {
            if (!textureCache[matData.texture]) textureCache[matData.texture] = getGeneratedTexture(matData.texture);
            matParams.bumpMap = textureCache[matData.texture];
            matParams.bumpScale = matData.texture === 'felt' ? 0.05 : 0.02;
        }
        materials[matData.id] = new THREE.MeshStandardMaterial(matParams);
    });
    return materials;
  }, [project.materialsLibrary]); 

  const initialCameraPos: [number, number, number] = project.type === 'JEWELRY'
    ? [0.2, 0.15, 0.9]   // close for small jewelry scale
    : [1.7, 1.4, 4.1];   // standard for furniture booth
  
  const selectedPart = selectedSlotId ? placedParts.find(p => p.slotId === selectedSlotId) : null;
  const selectedPartDef = selectedPart ? project.partsLibrary.find(p => p.id === selectedPart.partId) : null;
  const isDoorSelected = selectedPartDef?.category === 'Doors';

  return (
    <div className="w-full h-full bg-gray-50 lg:rounded-2xl overflow-hidden relative shadow-inner group">
      <Canvas 
        shadows 
        camera={{ position: initialCameraPos, fov: 35 }} 
        gl={{ preserveDrawingBuffer: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        onPointerMissed={() => setHoveredSlotId(null)}
      >
        <Suspense fallback={null}>
          <ScreenshotHandler captureRef={captureFnRef} />
          <CameraController
            setFitCamera={handleSetFitCamera}
            modelRef={modelGroupRef}
          />
          <Environment preset="studio" background={false} />
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
          <pointLight position={[-10, 5, -5]} intensity={0.3} />
          
          <group position={[0, 0, 0]}>
             <group userData={{ isBackground: true }}>
                <Grid infiniteGrid fadeDistance={30} sectionColor={project.branding.primaryColor} cellColor="#cccccc" />
                 {project.type === 'FURNITURE' && (
                    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                        <planeGeometry args={[4, 4]} />
                        <meshStandardMaterial color="#eeeeee" toneMapped={true} />
                    </mesh>
                 )}
             </group>
             
             {project.type === 'FURNITURE' && <pointLight position={[0, 2.5, 0]} intensity={0.6} distance={5} decay={2} color="#fff7ed" />}

            <group ref={modelGroupRef}>
                {project.baseSlots.map((slot) => {
                const placed = placedParts.find(p => p.slotId === slot.id);

                if (placed) {
                    const partDef = project.partsLibrary.find(p => p.id === placed.partId);
                    if (!partDef) return null;
                    const mat = projectMaterials[placed.materialId] || projectMaterials[partDef.allowedMaterials[0]];

                    let content = (
                        <PartGeometry
                            type={partDef.geometryType}
                            dimensions={partDef.dimensions}
                            material={mat}
                            modelUrl={partDef.modelUrl}
                        />
                    );

                    if (partDef.category === 'Doors') {
                        const isOpen = placed.properties?.isOpen || false;
                        const hinge = placed.properties?.hinge || 'right';
                        const width = partDef.dimensions[0];
                        const offset = width / 2;
                        const pivotX = hinge === 'right' ? offset : -offset;
                        const openAngle = 65 * (Math.PI / 180);
                        const rotY = isOpen ? (hinge === 'right' ? -openAngle : openAngle) : 0;
                        content = (
                            <group position={[pivotX, 0, 0]} rotation={[0, rotY, 0]}>
                                <group position={[-pivotX, 0, 0]}>{content}</group>
                            </group>
                        );
                    }

                    return (
                    <group key={slot.id} position={slot.position} rotation={new THREE.Euler(...slot.rotation)}>
                        <group
                            onClick={(e) => { e.stopPropagation(); onSlotClick(slot.id); }}
                            onPointerOver={(e) => { e.stopPropagation(); setHoveredSlotId(slot.id); }}
                        >
                            {content}
                        </group>
                    </group>
                    );
                } else {
                    const isSelected = selectedSlotId === slot.id;
                    const nodeSize = 0.2;
                    const nodeColor = isSelected ? project.branding.secondaryColor : project.branding.primaryColor;
                    const nodeOpacity = isSelected ? 0.9 : 0.4;

                    return (
                    <group key={slot.id} position={slot.position} rotation={new THREE.Euler(...slot.rotation)}>
                        <mesh
                            onClick={(e) => { e.stopPropagation(); onSlotClick(slot.id); }}
                            onPointerOver={(e) => { e.stopPropagation(); setHoveredSlotId(slot.id); }}
                            visible={true}
                            userData={{ isGuide: true }}
                        >
                            <sphereGeometry args={[nodeSize, 24, 24]} />
                            <meshBasicMaterial color={nodeColor} transparent opacity={nodeOpacity} depthTest={false} toneMapped={true} />
                        </mesh>
                    </group>
                    );
                }
                })}
            </group>
          </group>
           <group userData={{ isBackground: true }}>
              <ContactShadows position={[0, -0.5, 0]} opacity={0.4} scale={20} blur={2} far={4} />
           </group>

          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
        </Suspense>
      </Canvas>
      <div className="absolute top-6 lg:top-8 right-6 lg:right-8 z-20">
          <button 
            onClick={() => fitCameraRef.current()}
            className="bg-white p-3 lg:p-4 rounded-full shadow-xl text-gray-700 hover:text-blue-600 hover:scale-110 transition active:scale-95"
            title="Zoom Extents"
          >
              <i className="fa-solid fa-compress-arrows-alt text-xl lg:text-2xl"></i>
          </button>
      </div>
      <div className="absolute top-6 lg:top-8 left-6 lg:left-8 pointer-events-none opacity-90 group-hover:opacity-100 transition z-20">
         <p className="text-xl lg:text-2xl font-black drop-shadow-sm" style={{ color: project.branding.textColor }}>
           <i className="fa-solid fa-cube mr-3"></i>
           {selectedSlotId ? "Select library part" : "Click connection point"}
         </p>
         {isDoorSelected && selectedSlotId && onUpdatePart && (
            <button 
                className="mt-4 pointer-events-auto bg-white/95 px-5 py-3 rounded-xl text-sm lg:text-base font-bold shadow-xl hover:bg-white text-gray-800 flex items-center transition active:scale-95"
                onClick={(e) => {
                    e.stopPropagation();
                    onUpdatePart(selectedSlotId, 'isOpen', !selectedPart?.properties?.isOpen);
                }}
            >
                {selectedPart?.properties?.isOpen ? <i className="fa-solid fa-door-closed mr-3"></i> : <i className="fa-solid fa-door-open mr-3"></i>}
                {selectedPart?.properties?.isOpen ? "Close Door" : "Open Door"}
            </button>
         )}
      </div>
    </div>
  );
});

export default Viewer3D;