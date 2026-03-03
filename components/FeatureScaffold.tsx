import React, { useState, useRef } from 'react';
import { FileNode, RelocateProject, ScaffoldResult } from '../types';
import { 
  FolderIcon, 
  XIcon, 
  LoaderIcon, 
  CheckCircleIcon,
  PlusIcon,
  LayoutIcon,
  DownloadIcon
} from './Icons';
import * as gemini from '../services/geminiService';
import { processFiles } from '../services/fileService';
import { SCAFFOLD_TEMPLATES } from '../constants';

interface FeatureScaffoldProps {
  onClose: () => void;
}

export const FeatureScaffold: React.FC<FeatureScaffoldProps> = ({ onClose }) => {
  const [project, setProject] = useState<RelocateProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scaffoldContext, setScaffoldContext] = useState<any>(null);
  const [isScaffoldDetecting, setIsScaffoldDetecting] = useState(false);
  const [isScaffoldGenerating, setIsScaffoldGenerating] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);
  const [scaffoldProgress, setScaffoldProgress] = useState<number | null>(null);
  const [quickScaffold, setQuickScaffold] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    
    try {
      const fileNodes = await processFiles(files);

      const newProject: RelocateProject = {
        id: Math.random().toString(36).substr(2, 9),
        name: files[0].webkitRelativePath.split('/')[0] || 'New Project',
        files: fileNodes,
        issues: [],
        status: 'scanning',
        createdAt: Date.now()
      };

      setProject(newProject);
      setIsProcessing(false);

      // Detect structure
      setIsScaffoldDetecting(true);
      const context = await gemini.detectProjectStructure(fileNodes);
      setScaffoldContext(context);
    } catch (err) {
      console.error("Scaffold Detection failed", err);
      setIsProcessing(false);
    } finally {
      setIsScaffoldDetecting(false);
    }
  };

  const generateFeature = async (templateId: string) => {
    if (!project || !scaffoldContext) return;
    setIsScaffoldGenerating(true);
    setScaffoldProgress(0);
    
    try {
      const template = SCAFFOLD_TEMPLATES.find((t: any) => t.id === templateId);
      const result = await gemini.generateScaffold(template?.name || templateId, project.files, scaffoldContext);
      
      for (let i = 0; i <= 100; i += 20) {
        setScaffoldProgress(i);
        await new Promise(r => setTimeout(r, 100));
      }

      const updatedFiles = [...project.files];
      
      result.filesToCreate.forEach((f: any) => {
        updatedFiles.push({
          path: f.path,
          name: f.path.split('/').pop() || '',
          content: f.content,
          extension: f.path.split('.').pop() || '',
          size: f.content.length
        });
      });

      result.filesToModify.forEach((m: any) => {
        const file = updatedFiles.find(f => f.path === m.path);
        if (file) {
          file.content = m.newContent;
          file.size = m.newContent.length;
        }
      });

      if (result.dependencies.length > 0) {
        const pkgJson = updatedFiles.find(f => f.name === 'package.json');
        if (pkgJson) {
          try {
            const pkg = JSON.parse(pkgJson.content);
            pkg.dependencies = pkg.dependencies || {};
            result.dependencies.forEach((dep: string) => {
              if (!pkg.dependencies[dep]) pkg.dependencies[dep] = "latest";
            });
            pkgJson.content = JSON.stringify(pkg, null, 2);
          } catch (e) {
            console.error("Failed to update package.json dependencies", e);
          }
        }
      }

      setProject({ ...project, files: updatedFiles });
      setScaffoldResult({
        createdFiles: result.filesToCreate.map((f: any) => f.path),
        modifiedFiles: result.filesToModify.map((m: any) => m.path),
        addedDependencies: result.dependencies,
        manualSteps: result.manualSteps
      });

    } catch (err) {
      console.error("Feature Generation failed", err);
    } finally {
      setIsScaffoldGenerating(false);
      setScaffoldProgress(null);
    }
  };

  const downloadProject = async () => {
    if (!project) return;
    const JSZip = (window as any).JSZip;
    const zip = new JSZip();
    project.files.forEach(file => zip.file(file.path, file.content));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_scaffolded.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#050505] border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-fade-in relative">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <LayoutIcon size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-white uppercase tracking-tight">Feature Scaffold</h2>
            <p className="hidden sm:block text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Engine Placement Module</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {project && (
            <button 
              onClick={downloadProject}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
            >
              <DownloadIcon />
              <span className="hidden xs:inline">Export Project</span>
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <XIcon size={20} />
          </button>
        </div>
      </div>

      {!project ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-700 mb-6 sm:mb-8">
            <LayoutIcon size={36} />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white uppercase mb-4">Initialize Scaffold Engine</h3>
          <p className="text-zinc-500 max-w-md mb-8 sm:mb-10 text-xs sm:text-sm leading-relaxed">
            Upload your project folder. The engine will detect your framework and architecture to generate production-ready modules safely.
          </p>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden" 
            {...({ webkitdirectory: "", directory: "" } as any)} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group flex items-center gap-4 px-8 py-4 sm:px-10 sm:py-5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl transition-all shadow-xl shadow-indigo-500/10 hover:-translate-y-1"
          >
            {isProcessing ? <LoaderIcon /> : <PlusIcon />}
            <span className="font-black uppercase tracking-widest text-xs sm:text-sm">Select Project Folder</span>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {isScaffoldDetecting ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              <LoaderIcon size={48} className="text-indigo-500 animate-spin mb-6" />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Detecting Architecture...</h3>
              <p className="text-zinc-500 text-xs mt-2 uppercase font-bold">Analyzing framework, routing, and folder patterns</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
              {/* Left Panel: Options */}
              <div className="w-full sm:w-80 border-r border-zinc-800 bg-black/20 p-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Project DNA</h4>
                  <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase">Detected</div>
                </div>
                
                <div className="space-y-3 mb-8">
                  <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Framework</p>
                    <p className="text-xs text-white font-bold">{scaffoldContext?.framework || 'Unknown'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Routing</p>
                    <p className="text-xs text-white font-bold">{scaffoldContext?.routing || 'Unknown'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Structure</p>
                    <p className="text-xs text-white font-bold">{scaffoldContext?.structure || 'Unknown'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Settings</h4>
                </div>
                <button 
                  onClick={() => setQuickScaffold(!quickScaffold)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${quickScaffold ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'}`}
                >
                  <span className="text-[10px] font-black uppercase">Quick Scaffold Mode</span>
                  <div className={`w-8 h-4 rounded-full relative transition-all ${quickScaffold ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${quickScaffold ? 'left-[18px]' : 'left-0.5'}`}></div>
                  </div>
                </button>
                <p className="text-[8px] text-zinc-600 mt-2 px-2 uppercase font-bold leading-relaxed">Skips deep analysis for rapid MVP generation.</p>
              </div>

              {/* Right Panel: Templates / Results */}
              <div className="flex-1 flex flex-col bg-[#050505] overflow-y-auto custom-scrollbar p-6 sm:p-10">
                {isScaffoldGenerating ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-full max-w-md bg-zinc-900 h-2 rounded-full overflow-hidden mb-6">
                      <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${scaffoldProgress}%` }}></div>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest animate-pulse">Generating Feature...</h3>
                    <p className="text-zinc-500 text-[10px] mt-2 uppercase font-bold">Wiring routes and injecting boilerplate</p>
                  </div>
                ) : scaffoldResult ? (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex items-center gap-4 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <CheckCircleIcon size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Scaffold Complete</h3>
                        <p className="text-emerald-500/70 text-[10px] font-black uppercase tracking-widest">Feature modules injected successfully</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Files Created</h4>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
                          {scaffoldResult.createdFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-300 font-mono">
                              <span className="text-emerald-500">+</span> {f}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Files Modified</h4>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
                          {scaffoldResult.modifiedFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-300 font-mono">
                              <span className="text-indigo-500">~</span> {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {scaffoldResult.addedDependencies.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Dependencies Added</h4>
                        <div className="flex flex-wrap gap-2">
                          {scaffoldResult.addedDependencies.map((d, i) => (
                            <span key={i} className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-black uppercase">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Manual Setup Required</h4>
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        {scaffoldResult.manualSteps.map((step, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500 flex-shrink-0">{i+1}</div>
                            <p className="text-xs text-zinc-300 font-medium leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setScaffoldResult(null)}
                      className="w-full py-4 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white hover:border-zinc-600 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      Generate Another Feature
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">Select Feature Template</h3>
                      <p className="text-zinc-500 text-xs font-medium">Choose a production-ready module to scaffold into your project.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SCAFFOLD_TEMPLATES.map((template) => (
                        <button 
                          key={template.id}
                          onClick={() => generateFeature(template.id)}
                          className="group text-left p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl hover:border-indigo-500/50 transition-all hover:-translate-y-1"
                        >
                          <h4 className="text-lg font-black text-white uppercase tracking-tight mb-2 group-hover:text-indigo-400 transition-colors">{template.name}</h4>
                          <p className="text-xs text-zinc-500 font-medium leading-relaxed">{template.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
