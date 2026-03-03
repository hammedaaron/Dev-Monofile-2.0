import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GeneratedOutputs, ConceptBundle, ChatMessage, Project } from '../types';
import { DownloadIcon, CopyIcon, CheckCircleIcon, SparklesIcon, LoaderIcon, XIcon, PlusIcon, FileIcon } from './Icons';
import { downloadStringAsFile } from '../services/fileService';
import { recreateFeatureContext, startCodebaseChat } from '../services/geminiService';
import { marked } from 'marked';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface ViewerProps {
  outputs: GeneratedOutputs;
  currentProject: Project;
  otherProjects: Project[];
  onUpdateOutputs?: (newOutputs: GeneratedOutputs) => void;
  onUpdateProject?: (updates: Partial<Project>) => void;
  onOpenPWA?: () => void;
}

const Viewer: React.FC<ViewerProps> = ({ outputs, currentProject, otherProjects, onUpdateOutputs, onUpdateProject, onOpenPWA }) => {
  const [activeTab, setActiveTab] = useState<'flattened' | 'summary' | 'context' | 'recreator' | 'intelligence' | 'map'>('flattened');
  const [copied, setCopied] = useState(false);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatInstance = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getContent = () => {
    switch (activeTab) {
      case 'flattened': return outputs.flattened;
      case 'summary': return outputs.summary;
      case 'context': return outputs.aiContext;
      case 'recreator': return outputs.recreatedContext || '';
      case 'map': return `${outputs.schematicMap || ''}\n\n## FOLDER ARCHITECTURE\n${outputs.folderMap || ''}`;
      default: return '';
    }
  };

  // Memoized Markdown
  const renderedContent = useMemo(() => {
    const content = getContent();
    if (!content) return '';
    try {
      return marked.parse(content, { async: false }) as string;
    } catch (e) {
      return content;
    }
  }, [activeTab, outputs.flattened, outputs.summary, outputs.aiContext, outputs.recreatedContext, outputs.schematicMap]);

  useEffect(() => {
    if (!debouncedSearchTerm || !sourceRef.current || activeTab !== 'flattened') {
      setSearchResults([]);
      return;
    }
    const content = outputs.flattened;
    const regex = new RegExp(debouncedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches: number[] = [];
    let match;
    // Limit matches to prevent hanging on very short terms in huge files
    let count = 0;
    while ((match = regex.exec(content)) !== null && count < 1000) {
      matches.push(match.index);
      count++;
    }
    setSearchResults(matches);
    setCurrentSearchIndex(0);
    if (matches.length > 0) {
      jumpToMatch(matches[0], debouncedSearchTerm.length);
    }
  }, [debouncedSearchTerm, outputs.flattened, activeTab]);

  useEffect(() => {
    chatInstance.current = null;
    setChatMessages([]);
  }, [currentProject.id, currentProject.knowledgeBridgeEnabled]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatting]);

  useEffect(() => {
    const renderMermaid = async () => {
      if (activeTab === 'map' && outputs.schematicMap && mermaidRef.current) {
        // Clean mermaid code from possible markdown wrapping
        const mermaidCode = outputs.schematicMap.match(/```mermaid([\s\S]*?)```/)?.[1] || 
                            outputs.schematicMap.match(/graph (?:TD|LR|BT|RL)[\s\S]*/)?.[0] || 
                            outputs.schematicMap;
        
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          const { svg } = await mermaid.render('mermaid-svg', mermaidCode.trim());
          if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
        } catch (err) {
          console.warn("Mermaid render failed", err);
        }
      }
    };
    renderMermaid();
  }, [activeTab, outputs.schematicMap]);

  const handleCopy = () => {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsExportingPDF(true);
    
    const element = pdfRef.current;
    
    // Calculate dimensions for a seamless, single-page PDF (Infinite Scroll Style)
    const widthPx = element.scrollWidth;
    const heightPx = element.scrollHeight;
    
    // Convert to mm (Standard A4 width is 210mm)
    const mmWidth = 210;
    const mmHeight = (heightPx * mmWidth) / widthPx;

    const opt = {
      margin: 0,
      filename: `monofile_${activeTab}_${currentProject.name.toLowerCase()}.pdf`,
      image: { type: 'jpeg' as const, quality: 1 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#050505',
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm' as const, 
        format: [mmWidth, mmHeight] as [number, number], // Dynamic height prevents page breaks
        orientation: 'portrait' as const
      }
    };

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("Seamless PDF Export failed", err);
      alert("PDF Export failed: Content size may exceed browser buffer limits.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDownload = (format: 'txt' | 'md' | 'pdf') => {
    if (format === 'pdf') {
      handleDownloadPDF();
      return;
    }
    const content = getContent();
    const prefix = activeTab === 'flattened' ? 'monofile_codebase' : `monofile_${activeTab}`;
    downloadStringAsFile(content, `${prefix}.${format}`, 'text/plain');
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const jumpToMatch = (index: number, length: number) => {
    if (!sourceRef.current) return;
    sourceRef.current.focus();
    sourceRef.current.setSelectionRange(index, index + length);
    
    const lines = outputs.flattened.substring(0, index).split('\n');
    const lineIndex = lines.length;
    sourceRef.current.scrollTop = (lineIndex * 20) - 150;
  };

  const nextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIdx);
    jumpToMatch(searchResults[nextIdx], searchTerm.length);
  };

  const handleExecuteRecreator = async () => {
    if (selectedConcepts.length === 0) return;
    setIsExecuting(true);
    setProgress(10);
    try {
      const conceptsToProcess = outputs.concepts.filter(c => selectedConcepts.includes(c.id));
      const result = await recreateFeatureContext(outputs.flattened, conceptsToProcess);
      setProgress(100);
      setTimeout(() => {
        if (onUpdateOutputs) onUpdateOutputs({ ...outputs, recreatedContext: result });
        setIsExecuting(false);
      }, 500);
    } catch (e) {
      setIsExecuting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isChatting) return;
    if (!chatInstance.current) chatInstance.current = startCodebaseChat(currentProject, otherProjects);
    const message = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);
    setIsChatting(true);
    try {
      const response = await chatInstance.current.sendMessage({ message });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "No response." }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  const isRichText = activeTab === 'summary' || activeTab === 'context' || activeTab === 'map' || (activeTab === 'recreator' && outputs.recreatedContext);

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 bg-[#0A0A0A] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="flex flex-col lg:flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/20 p-3 gap-3">
        <div className="flex flex-wrap items-center justify-center gap-1 bg-black/40 p-1 rounded-xl border border-zinc-800/50">
          {(['flattened', 'summary', 'context', 'recreator', 'map', 'intelligence'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${activeTab === tab ? 'bg-zinc-100 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
            >
              {tab === 'flattened' ? 'Source' : tab === 'summary' ? 'Audit' : tab === 'context' ? 'AI Brain' : tab === 'recreator' ? 'DNA' : tab === 'map' ? 'Map' : 'Intelligence'}
            </button>
          ))}
          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
          <button onClick={onOpenPWA} className="px-3 py-2 text-[10px] font-black rounded-lg text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-2 uppercase tracking-widest transition-all"><SparklesIcon /> PWA</button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'flattened' && (
            <div className="flex items-center bg-black border border-zinc-800 rounded-lg px-3 py-1.5 mr-2 shadow-inner group focus-within:border-indigo-500/50 transition-all">
               <input 
                type="text" 
                placeholder="FIND LOGIC..." 
                className="bg-transparent text-[10px] font-black text-white focus:outline-none w-24 md:w-40 placeholder:text-zinc-700 uppercase tracking-widest" 
                onChange={(e) => handleSearch(e.target.value)}
                value={searchTerm}
               />
               {searchResults.length > 0 && (
                 <div className="flex items-center gap-2 ml-2 border-l border-zinc-800 pl-2">
                   <span className="text-[9px] text-zinc-500 font-mono">
                     {currentSearchIndex + 1}/{searchResults.length}
                   </span>
                   <button onClick={nextMatch} className="text-indigo-400 hover:text-white text-[9px] font-black uppercase tracking-widest">Next</button>
                 </div>
               )}
            </div>
          )}
          {activeTab !== 'intelligence' && (
            <div className="flex items-center gap-1.5">
              {activeTab === 'recreator' && outputs.recreatedContext && (
                <button 
                  onClick={() => onUpdateOutputs?.({ ...outputs, recreatedContext: '' })} 
                  className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white bg-indigo-500/10 border border-indigo-500/20 rounded-lg transition-all"
                >
                  <XIcon size={12} /> Reset
                </button>
              )}
              
              <button onClick={handleCopy} title="Copy Content" className="p-2.5 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg transition-all border border-zinc-800 hover:border-zinc-700">
                {copied ? <CheckCircleIcon /> : <CopyIcon />}
              </button>

              <button 
                onClick={() => handleDownload('txt')} 
                title="Download as TXT"
                className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-all hover:bg-zinc-800"
              >
                <DownloadIcon /> TXT
              </button>

              <button 
                onClick={() => handleDownload('pdf')} 
                disabled={isExportingPDF}
                className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/20 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/10"
              >
                {isExportingPDF ? <LoaderIcon /> : <DownloadIcon />} PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[#050505] flex flex-col">
        {activeTab === 'intelligence' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <div className="p-6 rounded-3xl mb-6 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 animate-pulse"><SparklesIcon size={32} /></div>
                    <h4 className="text-white font-black uppercase tracking-[0.2em] text-sm mb-3">Deep Intelligence</h4>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest leading-relaxed">Architectural queries on Gemini 3 Pro reasoning. Analysis of structural integrity and logic flow.</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-zinc-900/50 border border-zinc-800 text-zinc-300 markdown-body shadow-xl'}`}>
                      {msg.role === 'model' ? <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text, { async: false }) as string }} /> : msg.text}
                    </div>
                  </div>
                ))}
                {isChatting && <div className="flex justify-start"><div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 flex items-center gap-3"><LoaderIcon /> <span className="text-[10px] font-black uppercase text-zinc-500 animate-pulse tracking-widest">Processing Intelligence...</span></div></div>}
                <div ref={chatEndRef} />
             </div>
             <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900/20 border-t border-zinc-800 flex gap-2">
                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="ASK ABOUT STRUCTURE, BUGS, OR IMPROVEMENTS..." className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-4 text-[11px] font-bold text-white focus:outline-none focus:border-indigo-500 uppercase tracking-widest placeholder:text-zinc-700" />
                <button type="submit" disabled={!userInput.trim() || isChatting} className="bg-white text-black px-8 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all hover:bg-zinc-200">Query</button>
             </form>
          </div>
        ) : activeTab === 'recreator' && !outputs.recreatedContext && !isExecuting ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
             <div className="text-center mb-12">
               <h3 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic serif">DNA Extractor</h3>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Select structural modules for reconstruction</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-12 max-w-5xl">
                {outputs.concepts.map(concept => (
                  <button key={concept.id} onClick={() => setSelectedConcepts(prev => prev.includes(concept.id) ? prev.filter(i => i !== concept.id) : [...prev, concept.id])} className={`text-left p-6 rounded-2xl border transition-all duration-300 ${selectedConcepts.includes(concept.id) ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20' : 'bg-zinc-900/20 border-zinc-800/40 hover:bg-zinc-800/40 hover:border-zinc-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${selectedConcepts.includes(concept.id) ? 'text-indigo-400' : 'text-zinc-500'}`}>{concept.name}</span>
                      {selectedConcepts.includes(concept.id) && <CheckCircleIcon size={14} className="text-indigo-500" />}
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight leading-relaxed line-clamp-3">{concept.description}</p>
                  </button>
                ))}
             </div>
             <button onClick={handleExecuteRecreator} disabled={selectedConcepts.length === 0} className="px-16 py-6 rounded-full font-black text-xl bg-white text-black disabled:opacity-20 flex items-center gap-4 active:scale-95 transition-all shadow-2xl hover:bg-zinc-100"><SparklesIcon /> Extract Modules</button>
          </div>
        ) : activeTab === 'map' ? (
          <div className="w-full h-full overflow-y-auto p-6 sm:p-10 md:p-16 custom-scrollbar" ref={pdfRef}>
            <div className="pdf-export-mode bg-[#050505] p-10 rounded-2xl min-h-full border border-zinc-900">
              <div className="mb-20">
                <div className="flex items-center gap-5 mb-12">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400"><SparklesIcon size={24} /></div>
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic serif">Feature Map Schematic</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Logical dependency visualization</p>
                  </div>
                </div>
                <div ref={mermaidRef} className="bg-black border border-zinc-800 p-10 rounded-3xl overflow-x-auto flex justify-center mb-12 shadow-2xl">
                  {/* Mermaid SVG injected here */}
                  {!outputs.schematicMap && <div className="text-zinc-600 uppercase font-black text-[10px] tracking-[0.5em] animate-pulse">Initializing Schematic...</div>}
                </div>
                <div className="markdown-body bg-zinc-900/20 p-10 rounded-3xl border border-zinc-800/50" dangerouslySetInnerHTML={{ __html: marked.parse(outputs.schematicMap || "", { async: false }) as string }} />
              </div>

              <div>
                <div className="flex items-center gap-5 mb-12">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"><FileIcon size={24} /></div>
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic serif">Architecture Tree</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Structural hierarchy mapping</p>
                  </div>
                </div>
                <div className="bg-black border border-zinc-800 p-10 rounded-3xl font-mono text-[11px] leading-relaxed text-indigo-300 shadow-2xl">
                  {outputs.folderMap?.split('\n').map((line, i) => (
                    <div key={i} className="flex gap-6 border-b border-zinc-900/50 last:border-0 py-2 group hover:bg-zinc-900/30 transition-colors">
                      <span className="text-zinc-800 w-10 select-none font-black italic serif">{(i+1).toString().padStart(2, '0')}</span>
                      <span className="opacity-80 font-medium tracking-tight">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : isExecuting ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black px-12">
             <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-6"><span className="text-[12px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Reconstructing DNA...</span><span className="text-3xl font-black text-zinc-700 italic serif">{Math.round(progress)}%</span></div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)] transition-all duration-700" style={{ width: `${progress}%` }}></div></div>
             </div>
          </div>
        ) : isRichText ? (
          <div className="w-full h-full p-4 sm:p-10 md:p-16 overflow-y-auto markdown-body animate-fade-in-up custom-scrollbar" ref={pdfRef}>
             <div className="pdf-export-mode bg-[#050505] p-8 sm:p-16 rounded-3xl border border-zinc-800/20 shadow-2xl" dangerouslySetInnerHTML={{ __html: renderedContent }} />
          </div>
        ) : (
          <div className="w-full h-full relative group flex flex-col">
            <div className="flex-shrink-0 bg-zinc-900/50 border-b border-zinc-800 px-6 py-2 flex items-center justify-between">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Injected_Source.log</span>
              <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">UTF-8 / Read-Only</span>
            </div>
            <textarea ref={sourceRef} readOnly value={getContent()} className="flex-1 w-full p-8 sm:p-12 bg-transparent text-zinc-400 font-mono text-[11px] sm:text-xs md:text-sm resize-none focus:outline-none leading-relaxed custom-scrollbar selection:bg-indigo-500/30" spellCheck={false} />
            <div className="absolute bottom-6 right-10 text-[9px] font-black text-zinc-800 uppercase tracking-[0.4em] pointer-events-none group-hover:text-zinc-600 transition-colors">MONOFILE_CORE_V1.0</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewer;