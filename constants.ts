// Centralized configuration for AI Models
// If a model is deprecated, change it here.
export const AI_CONFIG = {
  // The smart model for deep reasoning (Chat/Architecture)
  SMART_MODEL: "gemini-3-pro-preview", 
  
  // The fast model for quick summaries (Ingestion)
  FAST_MODEL: "gemini-3-flash-preview",
  
  // Fallback if the others fail
  FALLBACK_MODEL: "gemini-3-flash-preview"
};

// Simple obfuscation for storage keys to prevent casual shoulder-surfing
export const STORAGE_KEYS = {
  API_KEY: 'monofile_k_sec', // Changed name to force a clean login session for the update
  GH_TOKEN: 'monofile_gh_t'
};

export const SCAFFOLD_TEMPLATES = [
  { id: 'auth', name: 'Authentication', description: 'JWT-based frontend structure' },
  { id: 'crud', name: 'CRUD Module', description: 'Standard Create, Read, Update, Delete' },
  { id: 'protected-routes', name: 'Protected Route System', description: 'Auth-guarded navigation' },
  { id: 'admin-layout', name: 'Admin Dashboard Layout', description: 'Sidebar + Header + Content' },
  { id: 'form-validation', name: 'Form + Validation', description: 'Zod/Hook-form structure' },
  { id: 'api-layer', name: 'API Service Layer', description: 'Axios/Fetch wrappers' },
  { id: 'rbac', name: 'Role-Based Access', description: 'Permission-based UI wrapper' },
  { id: 'global-state', name: 'Global State Setup', description: 'Context-based state management' },
];
