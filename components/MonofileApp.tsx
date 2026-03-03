import React, { useState, useEffect, useRef } from 'react';
import Uploader from './Uploader';
import StatsBar from './StatsBar';
import Viewer from './Viewer';
import { PWAGenerator } from './PWAGenerator';
import { ApiRelocate } from './ApiRelocate';
import { FeatureScaffold } from './FeatureScaffold';
import * as storage from '../services/storageService';
import { AppStatus, Project } from '../types';
import { LoaderIcon, CheckCircleIcon, SparklesIcon, PlusIcon, XIcon, ShieldIcon, LayoutIcon } from './Icons';
import { useProjectProcessor } from '../hooks/useProjectProcessor';

interface MonofileAppProps {
  forceMenu?: boolean;
  onMenuClose?: () => void;
}

const MonofileApp: React.FC<MonofileAppProps> = ({ forceMenu, onMenuClose }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [isSynced, setIsSynced] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [showScaffoldModal, setShowScaffoldModal] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await storage.getAllProjects();
        if (stored && stored.length > 0) {
          setProjects(stored);
          setActiveProjectId(stored[0].id);
        }
      } catch (err) {
        console.error("Storage offline", err);
      }
    };
    loadData();
  }, []);

  const createNewProject = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newProject: Project = {
      id: newId,
      name: `Project_${projects.length + 1}`,
      status: AppStatus.IDLE,
      stats: null,
      knowledgeBridgeEnabled: false,
      outputs: { flattened: '', summary: '', aiContext: '', concepts: [] },
      createdAt: Date.now()
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newId);
    setLogs([]);
    setIsSynced(false);
    storage.saveProject(newProject);
  };

  const updateActiveProject = async (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    setProjects(prev => {
      const updated = prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p);
      const active = updated.find(p => p.id === activeProjectId);
      if (active) storage.saveProject(active);
      return updated;
    });
  };

  const { handleFilesSelected } = useProjectProcessor({
    activeProject,
    updateActiveProject,
    addLog,
    setLogs,
    setIsSynced
  });

  const closeProject = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const projectToDelete = projects.find(p => p.id === id);
    if (!projectToDelete) return;

    const confirmed = window.confirm(`DECOMMISSION COMMAND: Are you sure you want to permanently erase the "${projectToDelete.name}" environment? This cannot be undone.`);
    
    if (!confirmed) return;

    // 1. Optimistic UI update: Remove from state immediately
    const remainingProjects = projects.filter(p => p.id !== id);
    setProjects(remainingProjects);

    // 2. Persistent storage deletion
    try {
      await storage.deleteProject(id);
    } catch (err) {
      console.error("Failed to delete project from storage:", err);
      // Optional: Refresh from storage if delete failed
      const stored = await storage.getAllProjects();
      setProjects(stored);
      alert("Operational Fault: Could not delete environment from persistent storage.");
      return;
    }

    // 3. Handle active project switch
    if (activeProjectId === id) {
      if (remainingProjects.length > 0) {
        setActiveProjectId(remainingProjects[0].id);
      } else {
        setActiveProjectId(null);
        setLogs([]);
      }
    }
  };

  if ((projects.length === 0 || forceMenu) && !showPWAModal && !showRelocateModal && !showScaffoldModal) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center pt-20 sm:pt-32 px-6 overflow-y-auto custom-scrollbar">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in-up w-full max-w-4xl">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-4 sm:mb-6 text-gradient-animate leading-none">MONOFILE</h1>
            <p className="text-zinc-500 max-w-sm mx-auto uppercase tracking-[0.4em] text-[8px] sm:text-[10px] font-black">Environment Manager</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 w-full max-w-7xl">
            <button onClick={() => { createNewProject(); onMenuClose?.(); }} className="group flex items-center gap-4 sm:gap-6 lg:gap-8 px-6 py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-10 bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl lg:rounded-[3.5rem] hover:border-indigo-500/50 transition-all duration-700 shadow-2xl hover:-translate-y-2">
              <div className="w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-indigo-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0"><PlusIcon /></div>
              <div className="text-left"><h3 className="text-base sm:text-lg lg:text-2xl font-black text-white uppercase tracking-widest leading-tight">Establish Env</h3><p className="text-[8px] sm:text-[10px] lg:text-sm text-zinc-500 font-bold uppercase">New project partition</p></div>
            </button>
            <button onClick={() => { setShowPWAModal(true); onMenuClose?.(); }} className="group flex items-center gap-4 sm:gap-6 lg:gap-8 px-6 py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-10 bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl lg:rounded-[3.5rem] hover:border-emerald-500/50 transition-all duration-700 shadow-2xl hover:-translate-y-2">
              <div className="w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0"><SparklesIcon /></div>
              <div className="text-left"><h3 className="text-base sm:text-lg lg:text-2xl font-black text-white uppercase tracking-widest leading-tight">PWA Architect</h3><p className="text-[8px] sm:text-[10px] lg:text-sm text-zinc-500 font-bold uppercase">Asset stack generator</p></div>
            </button>
            <button onClick={() => { setShowRelocateModal(true); onMenuClose?.(); }} className="group flex items-center gap-4 sm:gap-6 lg:gap-8 px-6 py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-10 bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl lg:rounded-[3.5rem] hover:border-red-500/50 transition-all duration-700 shadow-2xl hover:-translate-y-2">
              <div className="w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-red-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0"><ShieldIcon size={24} /></div>
              <div className="text-left"><h3 className="text-base sm:text-lg lg:text-2xl font-black text-white uppercase tracking-widest leading-tight">API Relocate</h3><p className="text-[8px] sm:text-[10px] lg:text-sm text-zinc-500 font-bold uppercase">Secure Workbench</p></div>
            </button>
            <button onClick={() => { setShowScaffoldModal(true); onMenuClose?.(); }} className="group flex items-center gap-4 sm:gap-6 lg:gap-8 px-6 py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-10 bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl lg:rounded-[3.5rem] hover:border-indigo-500/50 transition-all duration-700 shadow-2xl hover:-translate-y-2">
              <div className="w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0"><LayoutIcon size={24} /></div>
              <div className="text-left"><h3 className="text-base sm:text-lg lg:text-2xl font-black text-white uppercase tracking-widest leading-tight">Feature Scaffold</h3><p className="text-[8px] sm:text-[10px] lg:text-sm text-zinc-500 font-bold uppercase">Engine Placement</p></div>
            </button>
          </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center relative overflow-hidden">
      {showPWAModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <PWAGenerator onClose={() => setShowPWAModal(false)} initialName={activeProject?.name} />
            </div>
        </div>
      )}

      {showRelocateModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-7xl h-[90vh]">
                <ApiRelocate onClose={() => setShowRelocateModal(false)} />
            </div>
        </div>
      )}

      {showScaffoldModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-7xl h-[90vh]">
                <FeatureScaffold onClose={() => setShowScaffoldModal(false)} />
            </div>
        </div>
      )}

      <div className="w-full mt-12 mb-6 px-8 flex flex-wrap items-center justify-center sm:justify-between gap-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
           <button onClick={() => { setShowPWAModal(true); setShowRelocateModal(false); setShowScaffoldModal(false); }} className={`flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border transition-all ${showPWAModal ? 'bg-zinc-900 border-emerald-500/50 text-emerald-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><SparklesIcon /><span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">PWA Architect</span></button>
           <button onClick={() => { setShowRelocateModal(true); setShowPWAModal(false); setShowScaffoldModal(false); }} className={`flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border transition-all ${showRelocateModal ? 'bg-zinc-900 border-red-500/50 text-red-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><ShieldIcon /><span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">API Relocate</span></button>
           <button onClick={() => { setShowScaffoldModal(true); setShowPWAModal(false); setShowRelocateModal(false); }} className={`flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border transition-all ${showScaffoldModal ? 'bg-zinc-900 border-indigo-500/50 text-indigo-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><LayoutIcon /><span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Feature Scaffold</span></button>
           {projects.map(p => (
             <div key={p.id} onClick={() => { setActiveProjectId(p.id); setShowPWAModal(false); setShowRelocateModal(false); setShowScaffoldModal(false); }} className={`group flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border transition-all cursor-pointer ${activeProjectId === p.id && !showPWAModal && !showRelocateModal && !showScaffoldModal ? 'bg-zinc-900 border-indigo-500/50 text-white shadow-xl' : 'bg-black border-zinc-800 text-zinc-500'}`}>
               <span className={`w-2 h-2 rounded-full ${p.status === AppStatus.COMPLETE ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`}></span>
               <span className="text-[9px] sm:text-[10px] font-black uppercase truncate max-w-[100px] sm:max-w-[140px]">{p.name}</span>
               <button onClick={(e) => closeProject(p.id, e)} className="opacity-40 group-hover:opacity-100 hover:text-red-400 p-1 transition-all"><XIcon size={14} /></button>
             </div>
           ))}
           <button onClick={createNewProject} className="p-3 sm:p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"><PlusIcon /></button>
        </div>
      </div>

      <main className="w-full flex-1 min-h-0 z-10 flex flex-col items-center pb-8 px-6 overflow-hidden">
        {activeProject && (
          <>
            {activeProject.status === AppStatus.IDLE && (
              <div className="w-full max-w-4xl py-12 animate-fade-in overflow-y-auto custom-scrollbar">
                <div className="text-center mb-16 relative">
                  <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">{activeProject.name}</h2>
                  <p className="text-zinc-600 font-bold text-xs uppercase tracking-widest">Provide codebase for extraction</p>
                </div>
                <Uploader onFilesSelected={handleFilesSelected} isProcessing={false} />
              </div>
            )}
            {(activeProject.status === AppStatus.PARSING || activeProject.status === AppStatus.PROCESSING_AI) && (
              <div className="w-full max-w-3xl pt-16 flex flex-col h-full">
                <div className="bg-black border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col flex-1">
                    <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-800 flex items-center justify-between font-mono text-[10px] text-zinc-500 uppercase">
                        <span>Ingestion_Protocol_${activeProject.name.toLowerCase()}.log</span>
                    </div>
                    <div className="flex-1 p-8 font-mono text-xs overflow-y-auto space-y-2 bg-[#050505] custom-scrollbar">
                        {logs.map((log, i) => <div key={i} className={`flex gap-3 ${log.includes('!') ? 'text-amber-500/80' : 'text-zinc-500'}`}><span className="text-indigo-500/50 font-bold">{'>>>'}</span><span className="flex-1">{log}</span></div>)}
                        <div ref={terminalEndRef} />
                    </div>
                </div>
            </div>
            )}
            {activeProject.status === AppStatus.COMPLETE && activeProject.stats && (
              <div className="w-full h-full flex flex-col animate-fade-in overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 w-full px-2 flex-shrink-0">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="font-black text-[10px] uppercase">{activeProject.name} Active</span>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-zinc-950 border border-zinc-900 px-5 py-2 rounded-full">
                       <span className="text-[10px] font-black text-zinc-600 uppercase">Bridge</span>
                       <button onClick={() => updateActiveProject({ knowledgeBridgeEnabled: !activeProject.knowledgeBridgeEnabled })} className={`w-10 h-5 rounded-full relative transition-all ${activeProject.knowledgeBridgeEnabled ? 'bg-indigo-600' : 'bg-zinc-800'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${activeProject.knowledgeBridgeEnabled ? 'left-[22px]' : 'left-1'}`}></div></button>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 mb-6 px-2">
                  <StatsBar stats={activeProject.stats} />
                </div>
                <div className="flex-1 min-h-0 w-full px-2">
                  <Viewer 
                    outputs={activeProject.outputs} 
                    currentProject={activeProject}
                    otherProjects={projects}
                    onUpdateOutputs={(newOutputs) => updateActiveProject({ outputs: newOutputs })} 
                    onUpdateProject={(p) => updateActiveProject(p)}
                    onOpenPWA={() => setShowPWAModal(true)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default MonofileApp;