export interface FileNode {
  path: string;
  name: string;
  content: string;
  extension: string;
  size: number;
}

export interface ConceptBundle {
  id: string;
  name: string;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ProcessingStats {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  PROCESSING_AI = 'PROCESSING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface GeneratedOutputs {
  flattened: string;
  summary: string;
  aiContext: string;
  concepts: ConceptBundle[];
  recreatedContext?: string;
  schematicMap?: string; // Mermaid or structural text for the map
  folderMap?: string;    // Segmented folder structure
}

export interface Project {
  id: string;
  name: string;
  status: AppStatus;
  stats: ProcessingStats | null;
  outputs: GeneratedOutputs;
  knowledgeBridgeEnabled: boolean;
  createdAt: number;
}

export interface RelocateIssue {
  id: string;
  file: string;
  type: 'vulnerability' | 'defect' | 'bad-practice' | 'exposed-secret';
  title: string;
  description: string;
  suggestion: string;
  fixed: boolean;
}

export interface RelocateProject {
  id: string;
  name: string;
  files: FileNode[];
  issues: RelocateIssue[];
  status: 'idle' | 'scanning' | 'ready' | 'fixing';
  createdAt: number;
}

export interface EnvIssue {
  id: string;
  file: string;
  line?: number;
  title: string;
  description: string;
  risk: 'critical' | 'warning' | 'safe';
  suggestion?: string;
}

export interface EnvGuardResult {
  issues: EnvIssue[];
  stats: {
    referencedVars: string[];
    definedVars: string[];
    missingVars: string[];
    duplicateVars: string[];
    unusedVars: string[];
  };
}

export interface DependencyIssue {
  id: string;
  name: string;
  type: 'unused' | 'missing' | 'vulnerable' | 'duplicate' | 'heavy';
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface DependencyGuardianResult {
  issues: DependencyIssue[];
  stats: {
    totalDeps: number;
    unusedDeps: number;
    vulnerableDeps: number;
    estimatedReduction: string;
  };
}

export interface ScaffoldTemplate {
  id: string;
  name: string;
  description: string;
}

export interface ScaffoldResult {
  createdFiles: string[];
  modifiedFiles: string[];
  addedDependencies: string[];
  manualSteps: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}