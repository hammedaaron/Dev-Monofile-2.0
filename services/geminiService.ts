import { FileNode, ConceptBundle, Project } from "../types";
import { AI_CONFIG } from "../constants";

const callAiProxy = async (model: string, contents: any, config?: any) => {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, contents, config })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "AI Proxy Error");
  }
  
  return await response.json();
};

const cleanAndParseJSON = (text: string) => {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    let content = jsonMatch ? jsonMatch[1] : text;
    
    if (!jsonMatch) {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');
      
      if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket && lastBrace > lastBracket))) {
        content = content.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1) {
        content = content.substring(firstBracket, lastBracket + 1);
      }
    }
    
    return JSON.parse(content.trim());
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw Text:", text);
    throw new Error("FAILED_TO_PARSE_AI_RESPONSE: The AI returned an invalid format.");
  }
};

const PROMPT_SUMMARY = `
You are a Principal Software Architect conducting a technical audit.
Analyze the provided codebase structure and content to generate a comprehensive "Codebase Executive Summary".
Format required (Markdown):
# Codebase Executive Summary
## 1. System Overview
## 2. Architecture & Patterns
## 3. Core Capabilities
## 4. Key Technical Components
## 5. Technology Stack
## 6. Ideal Use Cases
`;

const PROMPT_CONTEXT = `
You are an expert AI Data Engineer. Rewrite the essence of this codebase into a logic-dense "AI Context" format.
Output Format (Markdown):
# AI Context Optimized Context
## 1. Architectural Blueprint
## 2. Data Flow & State Management
## 3. Critical Path Analysis
## 4. Key Dependencies
## 5. Developer "Gotchas"
`;

const PROMPT_MAP = `
You are a Systems Designer. Create an "Architectural Schematic Map" of this application using Mermaid.js syntax.
The diagram should show the flow of data, component relationships, and key logic segments.
Include a section describing the "Logic Segmentation".
Return a response that includes a valid Mermaid.js block (e.g. graph TD) and a markdown explanation of the segmentation.
`;

const PROMPT_CONCEPTS = `
Analyze the provided codebase and identify 5 to 10 distinct "Feature Concepts" or "Architectural Bundles".
Return ONLY a JSON array of objects with "id" (kebab-case), "name" (Title Case), and "description" (one short sentence).
`;

const PROMPT_ENV_GUARD = `
You are a Security & DevOps Engineer. Scan the provided codebase for environment configuration risks and deployment fragility.
Focus strictly on:
1. Environment Variable Usage (process.env, import.meta.env, etc.)
2. Hardcoded Secrets (API keys, tokens, etc.)
3. Git Exposure (.env in .gitignore)
4. Deployment Integrity (missing .env.example, inconsistent naming)

Return ONLY a JSON object with:
{
  "issues": [
    {
      "id": "unique-id",
      "file": "path/to/file",
      "line": 12,
      "title": "Short Title",
      "description": "Explanation of risk",
      "risk": "critical" | "warning" | "safe",
      "suggestion": "How to fix it"
    }
  ],
  "stats": {
    "referencedVars": ["VAR1", "VAR2"],
    "definedVars": ["VAR1"],
    "missingVars": ["VAR2"],
    "duplicateVars": [],
    "unusedVars": []
  }
}
`;

const PROMPT_DEPENDENCY_GUARDIAN = `
You are a Senior DevOps & Build Engineer. Scan the provided codebase (especially package.json and imports) for dependency health.
Focus on:
1. Unused Dependencies (installed but not imported)
2. Missing Dependencies (imported but not in package.json)
3. Vulnerable Packages (known risky versions)
4. Duplicate Libraries (multiple libs doing the same thing)
5. Heavy Bundle Contributors

Return ONLY a JSON object with:
{
  "issues": [
    {
      "id": "unique-id",
      "name": "package-name",
      "type": "unused" | "missing" | "vulnerable" | "duplicate" | "heavy",
      "description": "Why this is an issue",
      "severity": "high" | "medium" | "low",
      "suggestion": "How to fix it"
    }
  ],
  "stats": {
    "totalDeps": 20,
    "unusedDeps": 3,
    "vulnerableDeps": 1,
    "estimatedReduction": "1.2MB"
  }
}
`;

const PROMPT_SCAFFOLD_DETECT = `
Analyze the provided codebase and detect:
1. Framework (React, Next.js, Vite, Express, etc.)
2. Routing style (App router / Pages router / React Router)
3. Language (JS / TS)
4. Folder structure pattern (Feature-based, Layer-based, Flat)

Return ONLY a JSON object with:
{
  "framework": "string",
  "routing": "string",
  "language": "string",
  "structure": "string"
}
`;

const PROMPT_SCAFFOLD_GENERATE = `
You are a Senior Software Architect. Generate a new feature scaffold for the provided project.
Feature to generate: {{FEATURE}}
Project Context: {{CONTEXT}}

Return ONLY a JSON object with:
{
  "filesToCreate": [
    { "path": "path/to/file", "content": "file content" }
  ],
  "filesToModify": [
    { "path": "path/to/file", "instruction": "how to modify", "newContent": "full new content" }
  ],
  "dependencies": ["pkg1", "pkg2"],
  "manualSteps": ["step 1", "step 2"]
}
`;

const PROMPT_RECREATOR = `
You are a 'System Recreator'. Based on the provided codebase and the SELECTED CONCEPTS, generate a 'Recreation Blueprint'.
Goal: Provide exactly what is needed to rebuild ONLY THESE FEATURES in a new project.

Selected Concepts to Extract: {{CONCEPTS}}

Output Format (Markdown):
# Reconstruction DNA Package: [Concept Names]
## 1. Core Logic Rules
## 2. Data Contract & State
## 3. Implementation Blueprint (Pseudo-Code)
## 4. Master Reconstructor Prompt
`;

const PROMPT_SCAN_API_KEYS = `
Analyze the provided codebase and identify any exposed API keys, secrets, or sensitive credentials in frontend or public-facing files.
Return ONLY a JSON array of objects with:
- "file": path to the file
- "key": the detected key/secret
- "variableName": a suggested environment variable name (e.g., VITE_STRIPE_KEY)
- "type": "exposed-secret"
`;

const PROMPT_WORKBENCH_AUDIT = `
Conduct a thorough technical audit of the provided codebase. Identify defects, vulnerabilities, and bad practices.
Return ONLY a JSON array of objects with:
- "id": unique string
- "file": path to the file
- "type": "vulnerability" | "defect" | "bad-practice"
- "title": short title
- "description": clear explanation
- "suggestion": how to fix it manually
- "fixCode": (optional) the refactored code block for the entire file or the specific section
`;

export const generateAIInsights = async (
  flattenedCode: string, 
  files: FileNode[]
): Promise<{ summary: string; aiContext: string; concepts: ConceptBundle[]; schematicMap: string; folderMap: string }> => {
  
  const model = AI_CONFIG.FAST_MODEL; 
  const fileTree = files.slice(0, 150).map(f => f.path).join('\n');
  const contextInput = `Structure:\n${fileTree}\n\nContent:\n${flattenedCode.substring(0, 500000)}`;

  const runTask = async (prompt: string, config?: any) => {
    try {
        const response = await callAiProxy(model, [{ parts: [{ text: prompt }, { text: contextInput }] }], config);
        return response.text || "";
    } catch (e) {
        console.warn("Primary model failed, trying fallback...", e);
        const fallbackResponse = await callAiProxy(AI_CONFIG.FALLBACK_MODEL, [{ parts: [{ text: prompt }, { text: contextInput }] }], config);
        return fallbackResponse.text || "";
    }
  };

  const [summary, aiContext, schematicMap, conceptsRaw] = await Promise.all([
    runTask(PROMPT_SUMMARY),
    runTask(PROMPT_CONTEXT),
    runTask(PROMPT_MAP),
    runTask(PROMPT_CONCEPTS, {
      responseMimeType: "application/json"
    })
  ]);

  let concepts: ConceptBundle[] = [];
  try {
    concepts = cleanAndParseJSON(conceptsRaw || "[]");
  } catch (e) {
    concepts = [{ id: 'core', name: 'Core Logic', description: 'Fundamental system operations.' }];
  }

  return { summary, aiContext, concepts, schematicMap: schematicMap || "", folderMap: fileTree };
};

export const scanProjectForSecrets = async (files: FileNode[]): Promise<any[]> => {
  const patterns = [
    { regex: /AIza[0-9A-Za-z-_]{35}/g, name: 'GOOGLE_API_KEY' },
    { regex: /sk-[a-zA-Z0-9]{48}/g, name: 'OPENAI_API_KEY' },
    { regex: /xox[baprs]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32}/g, name: 'SLACK_TOKEN' },
    { regex: /SG\.[0-9A-Za-z-_]{22}\.[0-9A-Za-z-_]{43}/g, name: 'SENDGRID_API_KEY' },
    { regex: /key-[0-9a-zA-Z]{32}/g, name: 'MAILGUN_API_KEY' }
  ];

  const results: any[] = [];
  files.forEach(file => {
    patterns.forEach(p => {
      const matches = file.content.match(p.regex);
      if (matches) {
        // Use a Set to avoid duplicates in the same file
        const uniqueMatches = Array.from(new Set(matches));
        uniqueMatches.forEach(match => {
          results.push({
            file: file.path,
            key: match,
            variableName: `VITE_${p.name}`,
            type: 'exposed-secret'
          });
        });
      }
    });
  });
  return results;
};

export const auditProject = async (files: FileNode[]): Promise<any[]> => {
  const model = AI_CONFIG.FAST_MODEL;
  const codebase = files.map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`).join('\n\n');
  
  const response = await callAiProxy(model, [{ parts: [{ text: PROMPT_WORKBENCH_AUDIT }, { text: codebase.substring(0, 500000) }] }], { responseMimeType: "application/json" });
  
  try {
    return cleanAndParseJSON(response.text || "[]");
  } catch (e) {
    return [];
  }
};

export const runEnvGuardScan = async (files: FileNode[]): Promise<any> => {
  const model = AI_CONFIG.FAST_MODEL;
  const codebase = files.map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`).join('\n\n');
  
  const response = await callAiProxy(model, [{ parts: [{ text: PROMPT_ENV_GUARD }, { text: codebase.substring(0, 500000) }] }], { responseMimeType: "application/json" });
  
  try {
    return cleanAndParseJSON(response.text || "{}");
  } catch (e) {
    return { issues: [], stats: { referencedVars: [], definedVars: [], missingVars: [], duplicateVars: [], unusedVars: [] } };
  }
};

export const runDependencyGuardianScan = async (files: FileNode[]): Promise<any> => {
  const model = AI_CONFIG.FAST_MODEL;
  const codebase = files.map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`).join('\n\n');
  
  const response = await callAiProxy(model, [{ parts: [{ text: PROMPT_DEPENDENCY_GUARDIAN }, { text: codebase.substring(0, 500000) }] }], { responseMimeType: "application/json" });
  
  try {
    return cleanAndParseJSON(response.text || "{}");
  } catch (e) {
    return { issues: [], stats: { totalDeps: 0, unusedDeps: 0, vulnerableDeps: 0, estimatedReduction: "0KB" } };
  }
};

export const detectProjectStructure = async (files: FileNode[]): Promise<any> => {
  const model = AI_CONFIG.FAST_MODEL;
  const fileTree = files.slice(0, 100).map(f => f.path).join('\n');
  
  const response = await callAiProxy(model, [{ parts: [{ text: PROMPT_SCAFFOLD_DETECT }, { text: `File Tree:\n${fileTree}` }] }], { responseMimeType: "application/json" });
  
  try {
    return cleanAndParseJSON(response.text || "{}");
  } catch (e) {
    return { framework: "Unknown", routing: "Unknown", language: "Unknown", structure: "Unknown" };
  }
};

export const generateScaffold = async (feature: string, files: FileNode[], context: any): Promise<any> => {
  const model = AI_CONFIG.FAST_MODEL;
  const fileTree = files.slice(0, 100).map(f => f.path).join('\n');
  const prompt = PROMPT_SCAFFOLD_GENERATE
    .replace("{{FEATURE}}", feature)
    .replace("{{CONTEXT}}", JSON.stringify(context));

  const response = await callAiProxy(model, [{ parts: [{ text: prompt }, { text: `Current Structure:\n${fileTree}` }] }], { responseMimeType: "application/json" });

  try {
    return cleanAndParseJSON(response.text || "{}");
  } catch (e) {
    return { filesToCreate: [], filesToModify: [], dependencies: [], manualSteps: [] };
  }
};

export const recreateFeatureContext = async (
  flattenedCode: string,
  selectedConcepts: ConceptBundle[]
): Promise<string> => {
  const model = AI_CONFIG.SMART_MODEL;
  const conceptNames = selectedConcepts.map(c => c.name).join(", ");
  const prompt = PROMPT_RECREATOR.replace("{{CONCEPTS}}", conceptNames);
  
  const response = await callAiProxy(model, [{ parts: [{ text: prompt }, { text: `Context:\n${flattenedCode.substring(0, 500000)}` }] }]);
  return response.text || "Failed to generate blueprint.";
};

export const startCodebaseChat = (currentProject: Project, otherProjects: Project[]): any => {
  const model = AI_CONFIG.SMART_MODEL;
  let fullContext = `Current Project [${currentProject.name}] Source:\n${currentProject.outputs.flattened.substring(0, 400000)}\n\n`;

  if (currentProject.knowledgeBridgeEnabled) {
    const bridged = otherProjects.filter(p => p.knowledgeBridgeEnabled && p.id !== currentProject.id);
    if (bridged.length > 0) {
      fullContext += `--- KNOWLEDGE BRIDGE ---\n`;
      bridged.forEach(p => {
        fullContext += `PROJECT: ${p.name}\nSUMMARY: ${p.outputs.summary}\n`;
      });
    }
  }

  const systemInstruction = `You are a Codebase Intelligence Assistant. Answer technical questions based on the provided source code context.\n\nContext:\n${fullContext}`;
  const history: any[] = [];

  return {
    sendMessage: async ({ message }: { message: string }) => {
      const contents = [
        ...history,
        { role: "user", parts: [{ text: message }] }
      ];
      
      const response = await callAiProxy(model, contents, { systemInstruction });
      
      history.push({ role: "user", parts: [{ text: message }] });
      history.push({ role: "model", parts: [{ text: response.text }] });
      
      return response;
    }
  };
};
