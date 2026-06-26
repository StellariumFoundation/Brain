import { useState, useEffect } from 'react';
import ContactsScreen from './components/ContactsScreen';
import ImportScreen from './components/ImportScreen';
import SettingsScreen from './components/SettingsScreen';
import { ScreenType } from './types';
import { Users, Upload, Settings as SettingsIcon, Brain, HelpCircle, Wifi, WifiOff, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncManager } from './utils/syncManager';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('contacts');
  const [isOnline, setIsOnline] = useState(syncManager.isOnline());
  const [pendingSyncCount, setPendingSyncCount] = useState(syncManager.getSyncQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // A simple counter incremented whenever database changes are made,
  // prompting the SettingsScreen metrics to refresh immediately.
  const [triggerRefreshStats, setTriggerRefreshStats] = useState(0);

  const handleDatabaseChange = () => {
    setTriggerRefreshStats(prev => prev + 1);
    setPendingSyncCount(syncManager.getSyncQueue().length);
  };

  useEffect(() => {
    // Listen for online/offline changes
    const unsubConnection = syncManager.onConnectionChange((online) => {
      setIsOnline(online);
      setPendingSyncCount(syncManager.getSyncQueue().length);
    });

    // Listen for queue sync operations
    const unsubSync = syncManager.onSyncChange(() => {
      setPendingSyncCount(syncManager.getSyncQueue().length);
      setTriggerRefreshStats(prev => prev + 1);
    });

    // Check status periodically
    const timer = setInterval(() => {
      setIsOnline(syncManager.isOnline());
      setPendingSyncCount(syncManager.getSyncQueue().length);
    }, 3000);

    return () => {
      unsubConnection();
      unsubSync();
      clearInterval(timer);
    };
  }, []);

  const triggerManualSync = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    await syncManager.syncNow();
    setIsSyncing(false);
    handleDatabaseChange();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden font-sans select-none text-slate-100">
      
      {/* Top Application Header - Sleek Fluid Glass Theme */}
      <header className="bg-slate-900/80 backdrop-blur-md px-4 py-3 md:px-6 flex items-center justify-between border-b border-slate-800/80 shrink-0 z-50">
        <div className="flex items-center gap-3">
          {/* Water-Droplet & Brain Fusion Logo */}
          <div className="relative flex items-center justify-center bg-gradient-to-tr from-teal-600 to-cyan-500 p-2 rounded-xl shadow-lg shadow-teal-500/20">
            <Brain className="h-5 w-5 text-white" />
            <span className="absolute -bottom-1 -right-1 bg-white text-teal-600 rounded-full p-0.5 border border-teal-100 shadow-xs">
              <span className="block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm md:text-base font-extrabold tracking-tight bg-gradient-to-r from-teal-300 via-cyan-200 to-white bg-clip-text text-transparent">
                Brain CRM
              </h1>
              {/* Dynamic Status Tag */}
              {isOnline ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-bold tracking-wider uppercase">
                  <Wifi className="h-2.5 w-2.5" />
                  <span>Cloud Synced</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-bold tracking-wider uppercase animate-pulse">
                  <WifiOff className="h-2.5 w-2.5" />
                  <span>Offline Active</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-teal-400/80 font-semibold uppercase tracking-widest">
              Fluid Database Environment
            </p>
          </div>
        </div>

        {/* Sync queue floating notification inside the header */}
        <AnimatePresence>
          {pendingSyncCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              onClick={triggerManualSync}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-slate-800 ${
                isOnline 
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
              title={isOnline ? "Click to trigger manual server sync" : "Offline. Queue will auto-sync when online."}
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {pendingSyncCount} pending change{pendingSyncCount > 1 ? 's' : ''}
              </span>
              {isOnline && (
                <span className="text-[10px] bg-teal-500 text-white px-1 py-0.2 rounded-sm font-bold uppercase tracking-wider scale-90">
                  Sync Now
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic status display on desktop if needed, otherwise empty space for layout balance */}
        <div className="hidden md:block text-xs text-slate-500 font-medium">
          Offline Cache & Cloud Synchronization Active
        </div>
      </header>

      {/* Main Active Screen Canvas with beautiful ambient water reflections */}
      <main className="flex-1 overflow-hidden relative bg-slate-950">
        
        {/* Subtle glowing ambient gradient backgrounds (the "fluid water" aesthetic) */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Offline notice bar for smaller screens */}
        {pendingSyncCount > 0 && (
          <div className="sm:hidden bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs py-1.5 px-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>{pendingSyncCount} offline modification{pendingSyncCount > 1 ? 's' : ''} queued</span>
            </div>
            {isOnline && (
              <button 
                onClick={triggerManualSync}
                className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold"
              >
                Sync
              </button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentScreen === 'contacts' && (
            <motion.div
              key="contacts-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col h-full"
            >
              <ContactsScreen onContactsChange={handleDatabaseChange} />
            </motion.div>
          )}

          {currentScreen === 'import' && (
            <motion.div
              key="import-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col h-full"
            >
              <ImportScreen onImportSuccess={() => setCurrentScreen('contacts')} />
            </motion.div>
          )}

          {currentScreen === 'settings' && (
            <motion.div
              key="settings-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col h-full"
            >
              <SettingsScreen 
                onDatabaseReset={handleDatabaseChange} 
                triggerRefreshStats={triggerRefreshStats} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Responsive Bottom Navigation Bar - Sleek Dark Design */}
      <nav className="bg-slate-900 border-t border-slate-800/80 py-2.5 px-4 shrink-0 shadow-2xl z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button
            id="nav-contacts-btn"
            onClick={() => setCurrentScreen('contacts')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 group cursor-pointer ${
              currentScreen === 'contacts' 
                ? 'text-teal-400 scale-105 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className={`h-5 w-5 transition-transform ${currentScreen === 'contacts' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] tracking-wide">Contacts</span>
          </button>

          <button
            id="nav-import-btn"
            onClick={() => setCurrentScreen('import')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 group cursor-pointer ${
              currentScreen === 'import' 
                ? 'text-teal-400 scale-105 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className={`h-5 w-5 transition-transform ${currentScreen === 'import' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] tracking-wide">Import CSV</span>
          </button>

          <button
            id="nav-settings-btn"
            onClick={() => setCurrentScreen('settings')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 group cursor-pointer ${
              currentScreen === 'settings' 
                ? 'text-teal-400 scale-105 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SettingsIcon className={`h-5 w-5 transition-transform ${currentScreen === 'settings' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] tracking-wide">Settings</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
