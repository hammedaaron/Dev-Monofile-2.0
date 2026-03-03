import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Splash from './pages/Splash';
import MonofileApp from './components/MonofileApp';
import HowItWorks from './pages/HowItWorks';
import { Admin } from './pages/Admin';

type Route = 'landing' | 'auth' | 'splash' | 'app' | 'how-it-works' | 'admin';

// 6 hours in milliseconds (Used only for session hygiene)
const SESSION_DURATION = 6 * 60 * 60 * 1000; 

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>('landing');
  const [forceMenu, setForceMenu] = useState(false);

  // Helper to clear session data
  const performExit = () => {
      localStorage.removeItem('monofile_auth_token');
      setRoute('landing');
      setForceMenu(false);
  };
  
  useEffect(() => {
    const checkServerConfig = async () => {
      try {
        const response = await fetch("/api/ai/health");
        if (response.ok) {
          const data = await response.json();
          if (data.configured) {
            // If server has a key, we can auto-login if we have a session
            const sessionRaw = localStorage.getItem('monofile_auth_token');
            if (sessionRaw) {
               setRoute('app');
            }
            return;
          }
        }
      } catch (e) {
        console.warn("Server config check failed");
      }
    };
    checkServerConfig();

    // 1. Check for API Key (Persistence Layer)
    const apiKey = localStorage.getItem('user_gemini_key') || localStorage.getItem('monofile_k_sec');
    
    // 2. Check for Active Session (Security Layer)
    const sessionRaw = localStorage.getItem('monofile_auth_token');
    
    // Logic: If Key exists, we treat them as capable of entering.
    // We prioritize the Key over the session token for the "Auto-Login" experience.
    if (apiKey && apiKey.startsWith('AIza')) {
       // If the user refreshed the browser, jump straight back to App
       setRoute('app');
    } 
    // If no key, we stay on 'landing' (default state)
  }, []);

  const handleAuthSuccess = () => {
    const sessionData = {
      authenticated: true,
      expiry: Date.now() + SESSION_DURATION
    };
    localStorage.setItem('monofile_auth_token', JSON.stringify(sessionData));
    setRoute('splash');
  };

  const handleSplashComplete = () => {
    setRoute('app');
  };
  
  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-indigo-500/30">
      {route === 'landing' && <Landing onNavigate={(r) => setRoute(r as Route)} />}
      
      {route === 'how-it-works' && <HowItWorks onNavigate={(r) => setRoute(r as Route)} />}

      {route === 'admin' && <Admin onBack={() => setRoute('landing')} />}

      {route === 'auth' && (
        <Auth 
          onSuccess={handleAuthSuccess} 
          onBack={() => setRoute('landing')} 
        />
      )}
      
      {route === 'splash' && <Splash onComplete={handleSplashComplete} />}
      
      {route === 'app' && (
          <div className="h-screen flex flex-col overflow-hidden relative">
              <nav className="absolute top-0 left-0 w-full px-8 py-6 flex justify-between items-center z-50 pointer-events-none">
                   <button 
                    onClick={() => { setRoute('landing'); setForceMenu(false); }}
                    className="pointer-events-auto text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors flex items-center gap-2 group"
                   >
                       <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                       Home
                   </button>
                   
                   <button 
                    onClick={performExit}
                    className="pointer-events-auto text-xs font-medium text-zinc-600 hover:text-white transition-colors"
                   >
                       Exit Workspace
                   </button>
              </nav>
              <div className="flex-1 min-h-0 w-full">
                <MonofileApp forceMenu={forceMenu} onMenuClose={() => setForceMenu(false)} />
              </div>
          </div>
      )}
    </div>
  );
};

export default App;