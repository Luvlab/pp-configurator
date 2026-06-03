import React, { useState, useEffect, useMemo, useRef } from 'react';
import Viewer3D, { ViewerRef } from './components/Viewer3D';
import AdminPanel from './components/AdminPanel';
import { Project, ProjectType, PlacedPart, CustomPartRequest, User, SavedDesign } from './types';
import { PROJECT_PHONEBOOTH, PROJECT_JEWELRY } from './constants';

const _searchParams = new URLSearchParams(window.location.search);
const _projectMode = _searchParams.get('mode');
// VITE_MODE env var lets a build be permanently locked to a project type
// (e.g. VITE_MODE=jewelry for the Peter Hoff Design standalone configurator).
// Falls back to URL ?mode= param, then defaults to PHONEBOOTH.
const _envMode = import.meta.env.VITE_MODE as string | undefined;
const DEFAULT_PROJECT =
  (_envMode === 'jewelry' || _projectMode === 'jewelry') ? PROJECT_JEWELRY : PROJECT_PHONEBOOTH;
import { analyzeCustomRequest } from './services/geminiService';

type ViewMode = 'editor' | 'dashboard' | 'showcase' | 'auth';

const App: React.FC = () => {
  // --- State ---
  const [currentProject, setCurrentProject] = useState<Project>(DEFAULT_PROJECT);
  const [placedParts, setPlacedParts] = useState<PlacedPart[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  
  // Navigation & Views
  const [view, setView] = useState<ViewMode>('editor');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Auth & User
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  
  // Data / Persistence
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [designName, setDesignName] = useState('');
  const [designDesc, setDesignDesc] = useState('');
  const [isPublicDesign, setIsPublicDesign] = useState(false);

  // AI
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [customRequest, setCustomRequest] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<CustomPartRequest | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [hoveredMaterial, setHoveredMaterial] = useState<string | null>(null);
  const viewerRef = useRef<ViewerRef>(null);

  // --- Effects ---

  // Initialize Styles
  useEffect(() => {
    const { branding } = currentProject;
    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    document.documentElement.style.setProperty('--brand-bg', branding.backgroundColor);
    document.documentElement.style.setProperty('--brand-text', branding.textColor);
  }, [currentProject]);

  // Load Mock Data
  useEffect(() => {
    // Simulate some public designs from community
    const mocks: SavedDesign[] = [
      {
        id: 'mock_1', userId: 'user_x', userName: 'Alice', name: 'Executive Pod', description: 'Maximum privacy for calls.',
        projectType: ProjectType.FURNITURE, placedParts: [], thumbnail: '', likes: 24, isPublic: true, createdAt: Date.now()
      },
    ];
    setSavedDesigns(mocks);
  }, []);

  // --- Actions ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if(authEmail && authUsername) {
        setUser({ id: 'user_' + Date.now(), email: authEmail, username: authUsername });
        setView('dashboard');
    }
  };

  const handleSaveDesign = () => {
    if (!user) {
        alert("Please login to save your design.");
        setView('auth');
        return;
    }
    setDesignName(`${currentProject.name} Custom`);
    setSaveModalOpen(true);
  };

  const confirmSaveDesign = () => {
    if(!user || !viewerRef.current) return;

    const snapshot = viewerRef.current.captureSnapshot();
    
    const newDesign: SavedDesign = {
        id: 'design_' + Date.now(),
        userId: user.id,
        userName: user.username,
        name: designName,
        description: designDesc,
        projectType: currentProject.type,
        placedParts: [...placedParts],
        thumbnail: snapshot,
        likes: 0,
        isPublic: isPublicDesign,
        createdAt: Date.now()
    };

    setSavedDesigns(prev => [newDesign, ...prev]);
    setSaveModalOpen(false);
    alert("Design saved successfully!");
  };

  const handleLoadDesign = (design: SavedDesign) => {
    setCurrentProject(design.projectType === ProjectType.JEWELRY ? PROJECT_JEWELRY : PROJECT_PHONEBOOTH);
    setPlacedParts(design.placedParts);
    setView('editor');
  };

  const handleLikeDesign = (id: string) => {
      setSavedDesigns(prev => prev.map(d => d.id === id ? { ...d, likes: d.likes + 1 } : d));
  };

  const handleExportImage = () => {
      if (viewerRef.current) {
          const dataUrl = viewerRef.current.captureSnapshot();
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `nexus_design_${Date.now()}.png`;
          link.click();
      }
  };

  const handleExportModel = () => {
      if (viewerRef.current) {
          viewerRef.current.exportModel();
      }
  };

  const activeProject = currentProject;

  const totalPrice = useMemo(() => {
    let total = activeProject.basePrice;
    placedParts.forEach(p => {
        const part = activeProject.partsLibrary.find(lib => lib.id === p.partId);
        const mat = activeProject.materialsLibrary.find(m => m.id === p.materialId);
        if (part && mat) {
            total += part.price * mat.priceModifier;
        }
    });
    return Math.floor(total);
  }, [activeProject, placedParts]);


  const handlePartSelect = (partId: string) => {
    if (!selectedSlotId) return;
    const part = activeProject.partsLibrary.find(p => p.id === partId);
    if (!part) return;

    const slot = activeProject.baseSlots.find(s => s.id === selectedSlotId);
    if (slot && slot.allowedCategories && slot.allowedCategories.length > 0) {
        if (!slot.allowedCategories.includes(part.category)) {
            alert(`This part (${part.category}) cannot be placed here. Allowed: ${slot.allowedCategories.join(', ')}`);
            return;
        }
    }

    const defaultMat = part.allowedMaterials[0] || activeProject.materialsLibrary[0]?.id || 'mat_steel';
    setPlacedParts(prev => {
        const existing = prev.filter(p => p.slotId !== selectedSlotId);
        // Initialize new part with empty properties
        return [...existing, { id: Math.random().toString(36).substr(2, 9), partId, slotId: selectedSlotId, materialId: defaultMat, properties: { isOpen: false, hinge: 'right' } }];
    });
  };

  const handleMaterialChange = (slotId: string, materialId: string) => {
    setPlacedParts(prev => prev.map(p => p.slotId === slotId ? { ...p, materialId } : p));
  };

  const handleUpdatePartProperties = (slotId: string, key: string, value: any) => {
      setPlacedParts(prev => prev.map(p => p.slotId === slotId ? { ...p, properties: { ...p.properties, [key]: value } } : p));
  };

  const handleRemovePart = (slotId: string) => {
      setPlacedParts(prev => prev.filter(p => p.slotId !== slotId));
      setSelectedSlotId(null);
  }

  const handleSlotClick = (slotId: string) => {
    setSelectedSlotId(slotId);
  };


  const handleAiRequest = async () => {
    if (!customRequest.trim()) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    const result = await analyzeCustomRequest(customRequest, currentProject.type);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const selectedPartInstance = placedParts.find(p => p.slotId === selectedSlotId);
  const selectedPartDef = selectedPartInstance ? activeProject.partsLibrary.find(p => p.id === selectedPartInstance.partId) : null;
  const currentSlot = activeProject.baseSlots.find(s => s.id === selectedSlotId);
  
  // Calculate display name for material
  const displayedMaterialName = hoveredMaterial || (selectedPartInstance ? activeProject.materialsLibrary.find(m => m.id === selectedPartInstance.materialId)?.name : null);

  // --- Sub-Components ---
  // (Components are inline for simplicity per requirements)
  const AuthView = () => (
    <div className="flex flex-col items-center justify-center h-full bg-white animate-fade-in-up overflow-y-auto">
        <div className="w-full max-w-lg p-10 bg-white rounded-2xl shadow-xl border border-gray-100 my-10 mx-4">
            <h2 className="text-4xl font-extrabold mb-8 text-center text-gray-900">Welcome to Nexus</h2>
            <div className="space-y-4 mb-8">
                <p className="text-center text-gray-500 font-bold uppercase text-sm mb-4">Quick Sign In</p>
                <div className="grid grid-cols-5 gap-3">
                     {[ { icon: 'google', color: 'text-red-500' }, { icon: 'facebook', color: 'text-blue-600' }, { icon: 'twitter', color: 'text-blue-400' }, { icon: 'apple', color: 'text-gray-900' }, { icon: 'linkedin', color: 'text-blue-700' }, { icon: 'github', color: 'text-gray-800' }, { icon: 'microsoft', color: 'text-green-600' }, { icon: 'discord', color: 'text-indigo-600' }, { icon: 'instagram', color: 'text-pink-600' }, { icon: 'tiktok', color: 'text-black' } ].map((s, i) => (
                         <button key={i} className="flex items-center justify-center h-14 bg-gray-50 hover:bg-gray-100 rounded-lg border transition transform hover:scale-105"><i className={`fab fa-${s.icon} text-2xl ${s.color}`}></i></button>
                     ))}
                </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
                <div><label className="block text-lg font-bold text-gray-700">Username</label><input type="text" required value={authUsername} onChange={e => setAuthUsername(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-4 border focus:ring-blue-500 focus:border-blue-500 bg-white text-lg" /></div>
                <div><label className="block text-lg font-bold text-gray-700">Email Address</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-4 border focus:ring-blue-500 focus:border-blue-500 bg-white text-lg" /></div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl">Sign In / Register</button>
            </form>
        </div>
    </div>
  );

  const DashboardView = () => (
      <div className="p-4 lg:p-10 h-full overflow-y-auto bg-gray-50"><div className="max-w-7xl mx-auto"><div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4"><h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">My Dashboard</h2><button onClick={() => setView('editor')} className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:bg-blue-700 transition transform hover:scale-105"><i className="fa-solid fa-plus mr-2"></i> New Project</button></div>{user ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{savedDesigns.filter(d => d.userId === user.id).length === 0 ? (<div className="col-span-full text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-300"><p className="text-gray-400 text-2xl font-bold">You haven't saved any designs yet.</p></div>) : (savedDesigns.filter(d => d.userId === user.id).map(design => (<div key={design.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl transition duration-300"><div className="h-56 bg-gray-100 relative">{design.thumbnail ? (<img src={design.thumbnail} alt={design.name} className="w-full h-full object-cover" />) : (<div className="flex items-center justify-center h-full text-gray-300"><i className="fa-solid fa-image text-5xl"></i></div>)}<div className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-md text-sm font-extrabold shadow uppercase tracking-wider text-gray-800">{design.projectType}</div></div><div className="p-6"><h3 className="font-bold text-2xl text-gray-900 mb-1">{design.name}</h3><p className="text-base text-gray-500 truncate mb-6">{design.description || 'No description'}</p><div className="flex space-x-3"><button onClick={() => handleLoadDesign(design)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-bold text-lg transition">Edit</button><button className="px-5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl" title="Delete"><i className="fa-solid fa-trash text-xl"></i></button></div></div></div>)))}</div>) : <p className="text-xl">Please login to view dashboard.</p>}</div></div>
  );

  const ShowcaseView = () => (
      <div className="p-4 lg:p-10 h-full overflow-y-auto bg-gray-50"><div className="max-w-7xl mx-auto"><div className="text-center mb-10 lg:mb-16"><h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">Community Showcase</h2><p className="text-lg lg:text-xl text-gray-500">Discover what others are creating with Nexus.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-10">{savedDesigns.filter(d => d.isPublic).map(design => (<div key={design.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transform hover:-translate-y-2 transition duration-300"><div className="h-72 bg-gray-100 relative group">{design.thumbnail ? (<img src={design.thumbnail} alt={design.name} className="w-full h-full object-cover" />) : (<div className="flex items-center justify-center h-full bg-slate-100 text-gray-300"><i className="fa-solid fa-cube text-6xl"></i></div>)}<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-sm"><button onClick={() => handleLoadDesign(design)} className="bg-white text-black px-8 py-3 rounded-full font-bold text-lg transform scale-90 group-hover:scale-100 transition shadow-xl">Remix Design</button></div></div><div className="p-6"><div className="flex justify-between items-start mb-3"><div><h3 className="font-bold text-2xl text-gray-900">{design.name}</h3><p className="text-sm font-medium text-gray-500">by @{design.userName}</p></div><button onClick={() => handleLikeDesign(design.id)} className="flex flex-col items-center text-pink-500 hover:text-pink-600 transition"><i className="fa-solid fa-heart text-3xl"></i><span className="text-sm font-bold mt-1">{design.likes}</span></button></div><p className="text-gray-600 text-base mb-4 line-clamp-2">{design.description}</p><div className="flex items-center gap-2"><span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-bold uppercase tracking-wide">{design.projectType}</span></div></div></div>))}</div></div></div>
  );

  return (
    <div className="flex h-screen flex-col bg-brand-bg text-brand-text overflow-hidden font-sans">
      
      {/* Header Navigation */}
      <header className="flex-none bg-white border-b flex flex-col lg:flex-row items-center justify-between px-4 lg:px-8 py-2 lg:py-0 shadow-md z-30 lg:h-24 overflow-y-auto lg:overflow-visible gap-3 lg:gap-4 transition-all">
        <div className="flex w-full lg:w-auto items-center justify-between space-x-10">
            <div className="flex items-center space-x-4 cursor-pointer group shrink-0" onClick={() => setView('editor')}>
                <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl flex items-center justify-center text-white font-extrabold text-2xl lg:text-3xl shadow-lg transition transform group-hover:scale-110" style={{ backgroundColor: activeProject.branding.primaryColor }}>
                    {activeProject.branding.logoText.charAt(0)}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight" style={{ fontFamily: activeProject.branding.fontFamily }}>{activeProject.branding.logoText}</h1>
            </div>
            {/* Mobile Nav Toggle could go here, for now using simple responsive row */}
            <nav className="hidden lg:flex space-x-2">
                <button onClick={() => setView('editor')} className={`px-5 py-2 rounded-lg font-bold text-lg transition ${view === 'editor' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Editor</button>
                <button onClick={() => setView('showcase')} className={`px-5 py-2 rounded-lg font-bold text-lg transition ${view === 'showcase' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Showcase</button>
                {user && <button onClick={() => setView('dashboard')} className={`px-5 py-2 rounded-lg font-bold text-lg transition ${view === 'dashboard' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Dashboard</button>}
            </nav>
            {/* Mobile Hamburger substitute for navigation switching */}
             <div className="lg:hidden flex space-x-2">
                 <button onClick={() => setView('showcase')} className="text-gray-500 p-2"><i className="fa-solid fa-globe text-xl"></i></button>
                 {user && <button onClick={() => setView('dashboard')} className="text-gray-500 p-2"><i className="fa-solid fa-user text-xl"></i></button>}
             </div>
        </div>
        
        <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end space-x-4 lg:space-x-6 overflow-x-auto pb-1 lg:pb-0">
            {view === 'editor' && (
                <>
                    <div className="text-right hidden xl:flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg border shrink-0">
                        <p className="text-sm text-gray-400 uppercase font-extrabold tracking-wider">Price</p>
                        <p className="text-2xl lg:text-3xl font-extrabold text-green-600 leading-none">${totalPrice.toLocaleString()}</p>
                    </div>
                    <div className="flex space-x-2 shrink-0">
                        <button onClick={handleExportImage} className="text-gray-500 hover:text-gray-800 p-2 lg:p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition" title="Download Image"><i className="fa-solid fa-camera text-xl lg:text-2xl"></i></button>
                        <button onClick={handleExportModel} className="text-gray-500 hover:text-gray-800 p-2 lg:p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition" title="Download 3D Model"><i className="fa-solid fa-cube text-xl lg:text-2xl"></i></button>
                    </div>
                    <div className="flex space-x-2 shrink-0">
                         <button onClick={handleSaveDesign} className="px-4 lg:px-6 py-2 lg:py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-base lg:text-lg hover:border-gray-400 hover:bg-gray-50 transition">Save</button>
                         <button onClick={() => alert("Proceeding to checkout...")} className="px-5 lg:px-8 py-2 lg:py-3 rounded-xl text-white font-bold text-base lg:text-lg shadow-lg hover:opacity-90 transition transform hover:scale-105 active:scale-95" style={{ backgroundColor: activeProject.branding.primaryColor }}>Checkout</button>
                    </div>
                </>
            )}
            <div className="hidden lg:block h-10 w-px bg-gray-200"></div>
            {user ? (
                <div className="hidden lg:flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-inner ring-2 ring-white">{user.username.slice(0,2).toUpperCase()}</div>
                    <button onClick={() => { setUser(null); setView('auth'); }} className="text-base font-bold text-gray-500 hover:text-red-500">Sign Out</button>
                </div>
            ) : (<button onClick={() => setView('auth')} className="hidden lg:block text-gray-700 font-bold text-lg hover:text-blue-600">Log In</button>)}
            <button onClick={() => setIsAdminOpen(true)} className="text-gray-400 hover:text-gray-800 ml-2 p-2 hover:bg-gray-100 rounded-full transition" title="Admin Settings"><i className="fa-solid fa-cog text-xl lg:text-2xl"></i></button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'auth' && <AuthView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'showcase' && <ShowcaseView />}
        
        {view === 'editor' && (
            // Editor Grid: Flex Col Reverse on Mobile puts Viewer (flex-1) on TOP, Sidebar on BOTTOM
            <div className="flex h-full flex-col-reverse lg:flex-row">
                 {/* Editor Sidebar - Controls */}
                <aside className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-r flex flex-col shrink-0 shadow-2xl z-20 h-[38%] lg:h-full transition-all duration-300">

                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                        {!selectedSlotId ? (
                            <div className="text-center text-gray-400 mt-2 lg:mt-20 px-6 animate-fade-in">
                                <div className="inline-block p-4 lg:p-6 bg-gray-50 rounded-full mb-1 lg:mb-6"><i className="fa-solid fa-hand-pointer text-3xl lg:text-5xl text-gray-300"></i></div>
                                <h3 className="text-lg lg:text-xl font-bold text-gray-600 mb-1 lg:mb-2 uppercase tracking-wide">Start Designing</h3>
                                <p className="text-sm lg:text-lg pb-4">Select a connection point in the 3D view to add parts.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 lg:space-y-8 animate-fade-in-up">
                                <div className="flex justify-between items-center border-b pb-4">
                                    <h2 className="font-extrabold text-xl lg:text-2xl text-gray-800">{selectedPartDef ? 'Edit Component' : 'Add Component'}</h2>
                                    <button onClick={() => setSelectedSlotId(null)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition"><i className="fa-solid fa-times text-xl"></i></button>
                                </div>
                                
                                {currentSlot && currentSlot.allowedCategories && (
                                     <div className="text-xs font-semibold text-gray-500 bg-gray-50 p-2 rounded border uppercase tracking-wider">Allowed: {currentSlot.allowedCategories.join(', ')}</div>
                                )}

                                {/* Part Selection */}
                                <div className="space-y-3 lg:space-y-4">
                                    <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Select Part</label>
                                    <div className="grid grid-cols-1 gap-2 lg:gap-3">
                                        {activeProject.partsLibrary
                                            .filter(part => !currentSlot?.allowedCategories || currentSlot.allowedCategories.includes(part.category))
                                            .map(part => (
                                            <button 
                                                key={part.id}
                                                onClick={() => handlePartSelect(part.id)}
                                                className={`p-3 lg:p-4 rounded-xl border-2 text-left transition flex justify-between items-center group ${selectedPartInstance?.partId === part.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div>
                                                    <div className="text-base lg:text-lg font-bold text-gray-800">{part.name}</div>
                                                    <div className="text-xs lg:text-sm font-medium text-gray-500">{part.category}</div>
                                                </div>
                                                <div className="text-base lg:text-lg font-bold text-green-600 bg-green-50 px-2 lg:px-3 py-1 rounded-lg">${part.price}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setIsAiModalOpen(true)} className="w-full py-3 lg:py-4 border-2 border-dashed border-purple-300 rounded-xl text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition text-base lg:text-lg font-bold flex items-center justify-center mt-2 group">
                                        <i className="fa-solid fa-wand-magic-sparkles mr-3 text-xl group-hover:scale-110 transition"></i> AI Custom Part
                                    </button>
                                </div>

                                {/* Part Config for Doors */}
                                {selectedPartInstance && selectedPartDef && selectedPartDef.category === 'Doors' && (
                                    <div className="mt-4 p-4 lg:p-5 bg-gray-50 rounded-xl border border-gray-200">
                                        <label className="block text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-3">Door Config</label>
                                        <div className="flex flex-col space-y-3">
                                            <button 
                                                onClick={() => handleUpdatePartProperties(selectedSlotId, 'isOpen', !selectedPartInstance.properties?.isOpen)} 
                                                className={`w-full py-3 rounded-lg font-bold border-2 transition ${selectedPartInstance.properties?.isOpen ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-gray-300 text-gray-600'}`}
                                            >
                                                {selectedPartInstance.properties?.isOpen ? 'Close Door' : 'Open Door'}
                                            </button>
                                            
                                            <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden">
                                                <button 
                                                    onClick={() => handleUpdatePartProperties(selectedSlotId, 'hinge', 'left')} 
                                                    className={`flex-1 py-2 font-bold transition ${selectedPartInstance.properties?.hinge === 'left' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                                >
                                                    Left Hinge
                                                </button>
                                                <div className="w-px bg-gray-300"></div>
                                                <button 
                                                    onClick={() => handleUpdatePartProperties(selectedSlotId, 'hinge', 'right')} 
                                                    className={`flex-1 py-2 font-bold transition ${selectedPartInstance.properties?.hinge === 'right' || !selectedPartInstance.properties?.hinge ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                                >
                                                    Right Hinge
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Material Selection */}
                                {selectedPartInstance && selectedPartDef && (
                                    <div className="space-y-4 pt-4 lg:pt-6 border-t-2 border-gray-100">
                                        <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Color & Material</label>
                                        <div className="grid grid-cols-5 lg:grid-cols-6 gap-3 lg:gap-3">
                                            {/* Render ALL materials from library */}
                                            {activeProject.materialsLibrary.map(mat => {
                                                return (
                                                    <button 
                                                        key={mat.id}
                                                        onClick={() => handleMaterialChange(selectedSlotId, mat.id)}
                                                        onMouseEnter={() => setHoveredMaterial(mat.name)}
                                                        onMouseLeave={() => setHoveredMaterial(null)}
                                                        className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-gray-200 shadow-sm transition transform hover:scale-110 relative ${selectedPartInstance.materialId === mat.id ? 'ring-4 ring-offset-2 ring-blue-500 scale-110 border-white' : ''}`}
                                                        style={{ backgroundColor: mat.color }}
                                                        title={`${mat.name}`}
                                                    >
                                                        {selectedPartInstance.materialId === mat.id && <i className="fa-solid fa-check text-white text-lg drop-shadow-md"></i>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <div className="bg-white p-3 rounded-lg text-sm lg:text-base text-gray-700 border border-gray-200 font-medium shadow-sm min-h-[50px] flex items-center">
                                            {displayedMaterialName ? (
                                                <>{hoveredMaterial ? "Select:" : "Selected:"} <span className="font-bold text-gray-900 ml-2">{displayedMaterialName}</span></>
                                            ) : (<span className="text-gray-400 italic">Hover over a material...</span>)}
                                        </div>
                                        <button onClick={() => handleRemovePart(selectedSlotId)} className="w-full mt-4 lg:mt-6 py-3 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 hover:border-red-300 transition text-lg font-bold"><i className="fa-solid fa-trash mr-2"></i> Remove Part</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>
                {/* 3D Viewer Area - Takes remaining height, on mobile it's on top due to flex-col-reverse */}
                <div className="flex-1 bg-gray-200 relative min-h-[50vh] lg:min-h-0 z-10">
                     <Viewer3D
                        ref={viewerRef}
                        project={activeProject}
                        placedParts={placedParts}
                        onSlotClick={handleSlotClick}
                        selectedSlotId={selectedSlotId}
                        onUpdatePart={handleUpdatePartProperties}
                    />
                </div>
            </div>
        )}
      </main>

      {/* Admin Modal */}
      {isAdminOpen && <AdminPanel project={activeProject} onUpdateProject={setCurrentProject} onClose={() => setIsAdminOpen(false)} />}

      {/* Save Modal */}
      {saveModalOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 lg:p-8 w-full max-w-lg animate-scale-in">
                  <h3 className="text-2xl lg:text-3xl font-extrabold mb-6 text-gray-900">Save Your Design</h3>
                  <div className="space-y-6">
                      <div><label className="block text-lg font-bold text-gray-700 mb-2">Project Name</label><input type="text" value={designName} onChange={e => setDesignName(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 text-lg bg-gray-50" /></div>
                      <div><label className="block text-lg font-bold text-gray-700 mb-2">Description</label><textarea value={designDesc} onChange={e => setDesignDesc(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 text-lg bg-gray-50" rows={3}></textarea></div>
                      <div className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-100"><input type="checkbox" id="isPublic" checked={isPublicDesign} onChange={e => setIsPublicDesign(e.target.checked)} className="h-6 w-6 text-blue-600 rounded focus:ring-blue-500" /><label htmlFor="isPublic" className="ml-3 text-lg font-bold text-gray-800">Share to Community Showcase</label></div>
                      <div className="flex justify-end space-x-4 pt-6"><button onClick={() => setSaveModalOpen(false)} className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-lg">Cancel</button><button onClick={confirmSaveDesign} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg">Save Project</button></div>
                  </div>
              </div>
          </div>
      )}

      {/* AI Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up">
                <div className="bg-purple-700 p-6 lg:p-8 text-white">
                    <h2 className="text-2xl lg:text-3xl font-extrabold flex items-center"><i className="fa-solid fa-wand-magic-sparkles mr-4 text-purple-300"></i> AI Custom Studio</h2>
                    <p className="text-purple-100 mt-2 text-base lg:text-lg">Describe your dream part and let AI handle the engineering.</p>
                </div>
                <div className="p-6 lg:p-8 space-y-6">
                    {!aiAnalysis ? (
                        <>
                            <textarea className="w-full border-2 border-purple-100 rounded-xl p-5 focus:ring-4 focus:ring-purple-200 outline-none h-40 resize-none text-lg" placeholder="e.g. A dragon-shaped handle made of obsidian..." value={customRequest} onChange={(e) => setCustomRequest(e.target.value)}></textarea>
                            <button onClick={handleAiRequest} disabled={isAnalyzing || !customRequest.trim()} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-purple-700 disabled:opacity-50 shadow-lg transition transform active:scale-95">{isAnalyzing ? <><i className="fa-solid fa-circle-notch fa-spin mr-3"></i> Analyzing Feasibility...</> : "Analyze Request"}</button>
                        </>
                    ) : (
                        <div className="space-y-6">
                             <div className={`p-6 rounded-xl border-l-8 ${aiAnalysis.feasibility === 'high' ? 'bg-green-50 border-green-500' : aiAnalysis.feasibility === 'medium' ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
                                <h3 className="font-extrabold text-2xl mb-2 flex items-center">Feasibility: <span className="uppercase ml-2">{aiAnalysis.feasibility}</span></h3>
                                <p className="text-gray-700 text-lg leading-relaxed">{aiAnalysis.aiResponse}</p>
                             </div>
                             <div className="bg-gray-50 p-5 rounded-xl border border-gray-200"><span className="text-sm text-gray-500 uppercase font-extrabold tracking-wider">Estimated Cost</span><p className="text-3xl font-extrabold text-gray-900 mt-1">${aiAnalysis.estimatedCost}</p></div>
                             <div className="flex space-x-4 pt-4"><button onClick={() => setAiAnalysis(null)} className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-lg border border-gray-200">Back</button><button onClick={() => { setIsAiModalOpen(false); setAiAnalysis(null); setCustomRequest(""); alert("Request submitted to engineering team."); }} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg">Submit Request</button></div>
                        </div>
                    )}
                </div>
                 <div className="bg-gray-50 p-4 text-center border-t"><button onClick={() => setIsAiModalOpen(false)} className="text-base font-bold text-gray-500 hover:text-gray-800">Close</button></div>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;