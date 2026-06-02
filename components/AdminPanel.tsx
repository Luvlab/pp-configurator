import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { GLTFExporter } from 'three-stdlib';
import { Project, Branding, ProductPart, ProjectType, Material } from '../types';

interface AdminProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
  onClose: () => void;
}

const AVAILABLE_FONTS = [
  'sans-serif',
  'serif',
  'monospace',
  'Inter, sans-serif',
  'Playfair Display, serif',
  'Roboto Mono, monospace'
];

const RAL_COLORS = [
    { code: 'RAL 1003', name: 'Signal Yellow', hex: '#F9A800' },
    { code: 'RAL 1013', name: 'Oyster White', hex: '#E3D9C6' },
    { code: 'RAL 2004', name: 'Pure Orange', hex: '#F44611' },
    { code: 'RAL 3000', name: 'Flame Red', hex: '#AF2B1E' },
    { code: 'RAL 4005', name: 'Blue Lilac', hex: '#6C4675' },
    { code: 'RAL 5002', name: 'Ultramarine Blue', hex: '#20214F' },
    { code: 'RAL 5012', name: 'Light Blue', hex: '#3481B8' },
    { code: 'RAL 6005', name: 'Moss Green', hex: '#2F4538' },
    { code: 'RAL 6018', name: 'Yellow Green', hex: '#57A639' },
    { code: 'RAL 7016', name: 'Anthracite Grey', hex: '#293133' },
    { code: 'RAL 7035', name: 'Light Grey', hex: '#D7D7D7' },
    { code: 'RAL 9003', name: 'Signal White', hex: '#F4F4F4' },
    { code: 'RAL 9005', name: 'Jet Black', hex: '#0A0A0A' },
    { code: 'RAL 9010', name: 'Pure White', hex: '#F1F0EA' },
];

const convertStlToGlb = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loader = new STLLoader();
                const geometry = loader.parse(event.target?.result as ArrayBuffer);
                
                // Center geometry
                geometry.center();
                geometry.computeVertexNormals();

                // Create a standard mesh
                const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                const mesh = new THREE.Mesh(geometry, material);
                
                // FIX: Rotate -90 degrees on X to convert Z-up (CAD standard) to Y-up (Three.js standard)
                mesh.rotation.x = -Math.PI / 2;
                
                // FIX: Scale down by 0.1 (User reported 10x size import for mm units)
                mesh.scale.set(0.1, 0.1, 0.1);

                // Update matrix world before export to bake transforms
                mesh.updateMatrixWorld(true);

                const exporter = new GLTFExporter();
                exporter.parse(
                    mesh,
                    (gltf) => {
                        const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
                        resolve(URL.createObjectURL(blob));
                    },
                    (error) => reject(error),
                    { binary: true }
                );
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

const AdminPanel: React.FC<AdminProps> = ({ project, onUpdateProject, onClose }) => {
  const [activeTab, setActiveTab] = useState<'parts' | 'materials' | 'branding'>('parts');
  
  // Local state for branding form
  const [branding, setBranding] = useState<Branding>(project.branding);
  
  // New Material State
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialColor, setNewMaterialColor] = useState('#ffffff');
  const [localMaterials, setLocalMaterials] = useState<Material[]>(project.materialsLibrary);

  // Edit Part State
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedMaterialIndex, setDraggedMaterialIndex] = useState<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  // RAL Modal
  const [isRalPickerOpen, setIsRalPickerOpen] = useState(false);
  const [ralTarget, setRalTarget] = useState<'new' | string>('new'); // 'new' or material ID

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'part' | 'material', id: string | number, name?: string } | null>(null);

  useEffect(() => {
      setLocalMaterials(project.materialsLibrary);
  }, [project.materialsLibrary]);
  
  const handleBrandingChange = (key: keyof Branding, value: string) => {
    const newBranding = { ...branding, [key]: value };
    setBranding(newBranding);
    onUpdateProject({ ...project, branding: newBranding });
    document.documentElement.style.setProperty('--brand-primary', newBranding.primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', newBranding.secondaryColor);
    document.documentElement.style.setProperty('--brand-bg', newBranding.backgroundColor);
    document.documentElement.style.setProperty('--brand-text', newBranding.textColor);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newParts: ProductPart[] = [];
          const files = Array.from(e.target.files) as File[];
          
          for (const file of files) {
             const name = file.name.split('.')[0];
             const extension = file.name.split('.').pop()?.toLowerCase();
             let url = '';

             try {
                if (extension === 'skp') {
                    alert(`File ${file.name}: Native .skp support is limited in browsers. For best results, please export your SketchUp file to .glb or .stl.`);
                    continue; 
                } else if (extension === 'stl') {
                    // Convert STL to GLB Blob URL
                    url = await convertStlToGlb(file);
                } else {
                    // Create Object URL for GLB/GLTF
                    url = URL.createObjectURL(file);
                }

                // Smart Category Logic for Jewelry
                let category = 'Custom';
                if (project.type === ProjectType.JEWELRY) {
                    const lowerName = name.toLowerCase();
                    if (lowerName.includes('gem') || lowerName.includes('stone') || lowerName.includes('inter')) {
                        category = 'Interlink';
                    } else if (lowerName.includes('lock') || lowerName.includes('clasp') || lowerName.includes('end')) {
                        category = 'Lock';
                    } else {
                        // Default to Main Link for structural parts
                        category = 'Main Link';
                    }
                }
                
                const defaultGeometry = project.type === ProjectType.JEWELRY ? 'gem_plus' : 'box';
                
                newParts.push({
                    id: `part_custom_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                    name: name.replace(/_/g, ' '),
                    description: extension === 'stl' ? 'Converted from STL' : 'Imported custom model',
                    price: 100,
                    category: category,
                    geometryType: defaultGeometry, // Fallback, Viewer3D checks modelUrl first
                    dimensions: [1, 1, 1], 
                    allowedMaterials: project.materialsLibrary.map(m => m.id), // Allow all
                    modelUrl: url
                });
             } catch (err) {
                 console.error(`Failed to process file ${file.name}:`, err);
                 alert(`Error processing ${file.name}. Please ensure it is a valid 3D file.`);
             }
          }
          
          if (newParts.length > 0) {
              const updatedLib = [...project.partsLibrary, ...newParts];
              onUpdateProject({ ...project, partsLibrary: updatedLib });
              alert(`Successfully imported ${newParts.length} custom model(s). They are now available in the library.`);
          }
      }
  };

  const handleAddPart = () => {
      const newPart: ProductPart = {
          id: `part_new_${Date.now()}`,
          name: 'New Custom Part',
          description: 'Description of the new part',
          price: 0,
          category: project.type === ProjectType.JEWELRY ? 'Main Link' : 'Custom',
          geometryType: project.type === ProjectType.JEWELRY ? 'gem_plus' : 'box',
          dimensions: [1, 1, 1],
          allowedMaterials: project.materialsLibrary.map(m => m.id)
      };
      onUpdateProject({ ...project, partsLibrary: [...project.partsLibrary, newPart] });
      setExpandedPartId(newPart.id);
  };
  
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const fontName = e.target.files[0].name.split('.')[0];
          alert(`Font '${fontName}' uploaded successfully.`);
      }
  };

  const handleAddMaterial = () => {
    if (!newMaterialName) return;
    const newMat: Material = {
      id: `mat_${Date.now()}`,
      name: newMaterialName,
      color: newMaterialColor,
      roughness: 0.5,
      metalness: 0.5,
      priceModifier: 1.0
    };
    const updated = [...localMaterials, newMat];
    setLocalMaterials(updated);
    onUpdateProject({ ...project, materialsLibrary: updated });
    setNewMaterialName('');
  };

  const requestDeleteMaterial = (index: number) => {
      setDeleteTarget({ type: 'material', id: index, name: localMaterials[index]?.name || 'Material' });
  };

  const updateMaterial = (id: string, key: keyof Material, value: any) => {
    const updated = localMaterials.map(m => m.id === id ? { ...m, [key]: value } : m);
    setLocalMaterials(updated);
    onUpdateProject({ ...project, materialsLibrary: updated });
  };

  const updatePart = (id: string, key: keyof ProductPart, value: any) => {
    const updated = project.partsLibrary.map(p => p.id === id ? { ...p, [key]: value } : p);
    onUpdateProject({ ...project, partsLibrary: updated });
  };
  
  const requestDeletePart = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const part = project.partsLibrary.find(p => p.id === id);
    setDeleteTarget({ type: 'part', id, name: part?.name || 'Part' });
  };

  const executeDelete = () => {
      if (!deleteTarget) return;

      if (deleteTarget.type === 'part') {
          const updatedLib = project.partsLibrary.filter(p => p.id !== deleteTarget.id);
          onUpdateProject({ ...project, partsLibrary: updatedLib });
          if (expandedPartId === deleteTarget.id) setExpandedPartId(null);
      } else {
          const index = deleteTarget.id as number;
          const newMaterials = [...localMaterials];
          newMaterials.splice(index, 1);
          setLocalMaterials(newMaterials);
          onUpdateProject({ ...project, materialsLibrary: newMaterials });
      }
      setDeleteTarget(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedMaterialIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
      
      // Transparent image for drag ghosting (optional)
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedMaterialIndex === null || draggedMaterialIndex === index) return;
      
      const newMaterials = [...localMaterials];
      const draggedItem = newMaterials[draggedMaterialIndex];
      newMaterials.splice(draggedMaterialIndex, 1);
      newMaterials.splice(index, 0, draggedItem);
      
      // Update local state for drag animation
      setDraggedMaterialIndex(index);
      setLocalMaterials(newMaterials);
      
      // Real-time update to parent project (App)
      onUpdateProject({ ...project, materialsLibrary: newMaterials });
  };

  const handleDragEnd = () => {
      setDraggedMaterialIndex(null);
      dragOverItemIndex.current = null;
  };

  const handleRalSelect = (hex: string) => {
      if (ralTarget === 'new') {
          setNewMaterialColor(hex);
      } else {
          updateMaterial(ralTarget, 'color', hex);
      }
      setIsRalPickerOpen(false);
  };

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>, matId: string) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  updateMaterial(matId, 'textureUrl', ev.target.result as string);
              }
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end cursor-pointer" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col cursor-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b flex justify-between items-center bg-slate-900 text-white">
          <h2 className="text-3xl font-bold">Admin Backoffice</h2>
          <button onClick={onClose} className="hover:text-red-400 transition">
            <i className="fa-solid fa-times text-4xl"></i>
          </button>
        </div>

        <div className="flex border-b bg-gray-100">
          <button 
            className={`flex-1 py-6 font-bold text-xl ${activeTab === 'parts' ? 'bg-white border-t-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('parts')}
          >
             <i className="fa-solid fa-shapes mr-3"></i> Parts
          </button>
          <button 
            className={`flex-1 py-6 font-bold text-xl ${activeTab === 'materials' ? 'bg-white border-t-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('materials')}
          >
             <i className="fa-solid fa-palette mr-3"></i> Materials
          </button>
          <button 
            className={`flex-1 py-6 font-bold text-xl ${activeTab === 'branding' ? 'bg-white border-t-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('branding')}
          >
            <i className="fa-solid fa-paint-roller mr-3"></i> Branding
          </button>
        </div>

        <div className="p-8 flex-1">

        {activeTab === 'parts' && (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Parts Library ({project.partsLibrary.length})</h3>
                    <button onClick={handleAddPart} className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition flex items-center font-bold text-lg">
                        <i className="fa-solid fa-plus mr-3"></i> Add Part
                    </button>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-400 hover:border-blue-500 transition">
                    <label className="block text-lg font-bold text-gray-700 mb-2">Bulk Upload 3D Models (.glb, .gltf, .stl, .skp)</label>
                    <input type="file" multiple accept=".glb,.gltf,.stl,.skp" onChange={handleFileUpload} className="block w-full text-lg text-slate-500
                        file:mr-6 file:py-3 file:px-6
                        file:rounded-full file:border-0
                        file:text-lg file:font-bold
                        file:bg-blue-100 file:text-blue-700
                        hover:file:bg-blue-200
                        cursor-pointer
                    "/>
                    <p className="text-sm text-gray-500 mt-2">Upload .glb, .gltf, or .stl files. STL is auto-converted. SKP support is experimental.</p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {project.partsLibrary.map(part => (
                        <div key={part.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                             <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center mr-4 text-gray-400">
                                        <i className="fa-solid fa-cube text-xl"></i>
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{part.name}</p>
                                        <p className="text-sm text-gray-500">{part.category}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => setExpandedPartId(expandedPartId === part.id ? null : part.id)} 
                                        className={`px-4 py-2 rounded-lg font-bold transition flex items-center ${expandedPartId === part.id ? 'bg-blue-100 text-blue-700' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        <i className={`fa-solid ${expandedPartId === part.id ? 'fa-chevron-up' : 'fa-edit'} mr-2`}></i>
                                        {expandedPartId === part.id ? 'Close' : 'Edit'}
                                    </button>
                                </div>
                            </div>
                            
                            {expandedPartId === part.id && (
                                <div className="p-6 bg-white animate-fade-in-down">
                                    <div className="grid grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-1">Part Name</label>
                                            <input type="text" value={part.name} onChange={(e) => updatePart(part.id, 'name', e.target.value)} className="w-full p-3 border rounded-lg font-bold text-gray-800 bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-1">Category</label>
                                            {project.type === ProjectType.JEWELRY ? (
                                                <select value={part.category} onChange={(e) => updatePart(part.id, 'category', e.target.value)} className="w-full p-3 border rounded-lg font-bold text-gray-800 bg-white">
                                                    <option value="Main Link">Main Link</option>
                                                    <option value="Interlink">Interlink</option>
                                                    <option value="Lock">Lock</option>
                                                </select>
                                            ) : (
                                                 <input type="text" value={part.category} onChange={(e) => updatePart(part.id, 'category', e.target.value)} className="w-full p-3 border rounded-lg font-bold text-gray-800 bg-white" />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-1">Base Price ($)</label>
                                            <input type="number" value={part.price} onChange={(e) => updatePart(part.id, 'price', parseFloat(e.target.value))} className="w-full p-3 border rounded-lg font-bold text-gray-800 bg-white" />
                                        </div>
                                        {/* Hide Geometry Type for custom uploaded models as it is redundant */}
                                        {!part.modelUrl && (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-500 mb-1">{project.type === ProjectType.JEWELRY ? 'Parts Type' : 'Geometry Type'}</label>
                                                <select value={part.geometryType} onChange={(e) => updatePart(part.id, 'geometryType', e.target.value)} className="w-full p-3 border rounded-lg font-bold text-gray-800 bg-white">
                                                    {project.type === ProjectType.JEWELRY ? (
                                                        <>
                                                            <option value="custom_H">H-link</option>
                                                            <option value="gem_plus">Gem-link</option>
                                                            <option value="custom_lock">Lock-link</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="box">Box</option>
                                                            <option value="cylinder">Cylinder</option>
                                                            <option value="sphere">Sphere</option>
                                                            <option value="custom_H">Custom H-Link</option>
                                                            <option value="custom_lock">Custom Lock</option>
                                                            <option value="door_acoustic">Door (Acoustic)</option>
                                                            <option value="rounded_box">Rounded Box</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                     <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-2">Dimensions (X, Y, Z / R, H)</label>
                                        <div className="flex gap-2">
                                            {part.dimensions.map((dim, idx) => (
                                                <input 
                                                    key={idx} 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={dim} 
                                                    onChange={(e) => {
                                                        const newDims = [...part.dimensions];
                                                        newDims[idx] = parseFloat(e.target.value);
                                                        updatePart(part.id, 'dimensions', newDims);
                                                    }}
                                                    className="w-24 p-2 border rounded text-center font-mono text-sm bg-white"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {part.modelUrl && <p className="mt-4 text-xs text-green-600 font-bold"><i className="fa-solid fa-check-circle"></i> Custom 3D Model Attached</p>}
                                    <div className="mt-6 pt-6 border-t flex justify-between items-center">
                                        <p className="text-sm text-gray-400">ID: {part.id}</p>
                                        <button onClick={(e) => requestDeletePart(e, part.id)} className="text-red-500 hover:text-red-700 font-bold flex items-center"><i className="fa-solid fa-trash mr-2"></i> Delete Part</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          )}
          
          {activeTab === 'materials' && (
            <div className="space-y-8">
               <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Materials ({localMaterials.length})</h3>
                </div>
                
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h4 className="font-bold text-lg mb-4 text-blue-900">Add New Material</h4>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-600 mb-1">Name</label>
                            <input type="text" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} className="w-full p-2 rounded border bg-white border-gray-300" placeholder="e.g. Neon Green" />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-gray-600 mb-1">Color</label>
                             <div className="flex items-center gap-2">
                                <div className="h-10 w-12 rounded-md border border-gray-300 relative overflow-hidden shadow-sm">
                                     <input type="color" value={newMaterialColor} onChange={e => setNewMaterialColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
                                </div>
                                <button onClick={() => { setRalTarget('new'); setIsRalPickerOpen(true); }} className="px-2 py-2 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold text-gray-700">RAL</button>
                             </div>
                        </div>
                        <button onClick={handleAddMaterial} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Add</button>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-2"><i className="fa-solid fa-arrows-up-down mr-2"></i> Drag handle to reorder in real-time</p>
                    <div className="space-y-3">
                        {localMaterials.map((mat, index) => (
                            <div 
                                key={mat.id} 
                                onDragOver={(e) => handleDragOver(e, index)}
                                className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-4 transition-all duration-200 ${draggedMaterialIndex === index ? 'opacity-20 border-blue-500 bg-blue-50 scale-95' : 'border-gray-200 hover:border-blue-300'}`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                         <div 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnd={handleDragEnd}
                                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 p-3 rounded-lg border border-gray-200 hover:border-blue-200 transition"
                                            title="Drag to reorder"
                                         >
                                             <i className="fa-solid fa-grip-vertical text-lg"></i>
                                         </div>

                                         <div className="flex flex-col items-center gap-1">
                                            <div className="h-10 w-10 rounded-md border border-gray-300 relative overflow-hidden shadow-sm">
                                                <input type="color" value={mat.color} onChange={(e) => updateMaterial(mat.id, 'color', e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
                                            </div>
                                            <button onClick={() => { setRalTarget(mat.id); setIsRalPickerOpen(true); }} className="text-[10px] bg-gray-100 px-1 rounded font-bold hover:bg-gray-200">RAL</button>
                                         </div>
                                         <div className="flex-1">
                                             <input type="text" value={mat.name} onChange={(e) => updateMaterial(mat.id, 'name', e.target.value)} className="font-bold text-lg border border-gray-200 rounded p-1 w-full bg-white focus:ring-2 focus:ring-blue-500" />
                                             <p className="text-xs text-gray-400 mt-1">ID: {mat.id}</p>
                                         </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-col items-end">
                                         <div className="flex items-center gap-2">
                                             <button 
                                                onClick={() => requestDeleteMaterial(index)} 
                                                className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition"
                                                title="Delete Material"
                                             >
                                                <i className="fa-solid fa-trash"></i>
                                             </button>
                                         </div>
                                         <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold text-gray-500">Price x</label>
                                            <input type="number" step="0.1" value={mat.priceModifier} onChange={(e) => updateMaterial(mat.id, 'priceModifier', parseFloat(e.target.value))} className="w-16 p-1 border border-gray-300 rounded text-center font-bold bg-white" />
                                         </div>
                                         <label className="cursor-pointer flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                                            <i className="fa-solid fa-image"></i> {mat.textureUrl ? 'Change Texture' : 'Upload Texture'}
                                            <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleTextureUpload(e, mat.id)} />
                                         </label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Roughness ({mat.roughness})</label>
                                        <input type="range" min="0" max="1" step="0.1" value={mat.roughness} onChange={(e) => updateMaterial(mat.id, 'roughness', parseFloat(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Metalness ({mat.metalness})</label>
                                        <input type="range" min="0" max="1" step="0.1" value={mat.metalness} onChange={(e) => updateMaterial(mat.id, 'metalness', parseFloat(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}
          
          {activeTab === 'branding' && (
            <div className="space-y-8">
              <div className="space-y-6">
                 <h3 className="text-2xl font-bold border-b pb-3 text-gray-800">Color Palette</h3>
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Primary Color</label>
                        <div className="flex items-center">
                             <div className="h-12 w-12 rounded border border-gray-300 relative overflow-hidden cursor-pointer">
                                <input type="color" value={branding.primaryColor} onChange={(e) => handleBrandingChange('primaryColor', e.target.value)} className="absolute -top-2 -left-2 w-20 h-20 p-0 border-0" />
                            </div>
                            <input type="text" value={branding.primaryColor} onChange={(e) => handleBrandingChange('primaryColor', e.target.value)} className="ml-3 flex-1 bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border text-lg" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Secondary Color</label>
                        <div className="flex items-center">
                             <div className="h-12 w-12 rounded border border-gray-300 relative overflow-hidden cursor-pointer">
                                <input type="color" value={branding.secondaryColor} onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)} className="absolute -top-2 -left-2 w-20 h-20 p-0 border-0" />
                            </div>
                            <input type="text" value={branding.secondaryColor} onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)} className="ml-3 flex-1 bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border text-lg" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Background Color</label>
                         <div className="flex items-center">
                            <div className="h-12 w-12 rounded border border-gray-300 relative overflow-hidden cursor-pointer">
                                <input type="color" value={branding.backgroundColor} onChange={(e) => handleBrandingChange('backgroundColor', e.target.value)} className="absolute -top-2 -left-2 w-20 h-20 p-0 border-0" />
                            </div>
                            <input type="text" value={branding.backgroundColor} onChange={(e) => handleBrandingChange('backgroundColor', e.target.value)} className="ml-3 flex-1 bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border text-lg" />
                        </div>
                    </div>
                     <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Text Color</label>
                         <div className="flex items-center">
                             <div className="h-12 w-12 rounded border border-gray-300 relative overflow-hidden cursor-pointer">
                                <input type="color" value={branding.textColor} onChange={(e) => handleBrandingChange('textColor', e.target.value)} className="absolute -top-2 -left-2 w-20 h-20 p-0 border-0" />
                            </div>
                            <input type="text" value={branding.textColor} onChange={(e) => handleBrandingChange('textColor', e.target.value)} className="ml-3 flex-1 bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border text-lg" />
                        </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-2xl font-bold border-b pb-3 text-gray-800">Identity</h3>
                 <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Project Name (Logo Text)</label>
                        <input type="text" value={branding.logoText} onChange={(e) => handleBrandingChange('logoText', e.target.value)} className="block w-full bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-4 border text-xl font-bold" />
                    </div>
                    <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Typography</label>
                        <div className="flex gap-4">
                            <select value={branding.fontFamily} onChange={(e) => handleBrandingChange('fontFamily', e.target.value)} className="flex-1 bg-white border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-4 border text-lg">
                                {AVAILABLE_FONTS.map(font => (
                                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                                ))}
                            </select>
                            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg p-4 flex items-center justify-center font-bold text-gray-600 hover:text-gray-800 transition">
                                <i className="fa-solid fa-upload mr-2"></i> Custom Font
                                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                            </label>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>
      {isRalPickerOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">Select RAL Color</h3>
                      <button onClick={() => setIsRalPickerOpen(false)} className="text-gray-500 hover:text-red-500"><i className="fa-solid fa-times text-2xl"></i></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto p-2">
                      {RAL_COLORS.map(ral => (
                          <button 
                            key={ral.code}
                            onClick={() => handleRalSelect(ral.hex)}
                            className="flex flex-col items-center p-2 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200 transition"
                          >
                              <div className="w-16 h-16 rounded-md shadow-sm border border-gray-100 mb-2" style={{ backgroundColor: ral.hex }}></div>
                              <span className="text-xs font-bold text-gray-800">{ral.code}</span>
                              <span className="text-[10px] text-gray-500 text-center">{ral.name}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Confirm Deletion</h3>
                <p className="text-gray-600 mb-8">
                    Are you sure you want to delete <span className="font-bold text-gray-900">{deleteTarget.name}</span>? 
                    This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-4">
                    <button 
                        onClick={() => setDeleteTarget(null)} 
                        className="px-6 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-100 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={executeDelete} 
                        className="px-6 py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;