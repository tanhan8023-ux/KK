import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeSettings } from '../types';

interface Props {
  onUnlock: () => void;
  theme: ThemeSettings;
  key?: string;
  notification?: { title: string, body: string, personaId?: string } | null;
  personas?: any[];
}

export function LockScreen({ onUnlock, theme, notification, personas }: Props) {
  const [time, setTime] = useState(new Date());
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFingerprintClick = () => {
    if (isScanning || scanComplete) return;
    
    setIsScanning(true);
    
    // Quick scan animation
    setTimeout(() => {
      setScanComplete(true);
      setIsScanning(false);
      setTimeout(onUnlock, 300);
    }, 500);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-CN', options);
  };

  return (
    <motion.div 
      className="absolute inset-0 z-40 flex flex-col items-center pt-20 pb-12 text-neutral-800 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: '-100%', opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-[-1] bg-neutral-100">
        {theme.lockScreenWallpaper ? (
          <img 
            src={theme.lockScreenWallpaper} 
            alt="Lock Screen Background" 
            className="w-full h-full object-cover opacity-90"
          />
        ) : theme.wallpaper ? (
          <img 
            src={theme.wallpaper} 
            alt="Background" 
            className="w-full h-full object-cover opacity-90 blur-sm"
          />
        ) : (
          <img 
            src="https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=800&q=80" 
            alt="Snowy Background" 
            className="w-full h-full object-cover opacity-90 blur-sm"
          />
        )}
      </div>

      <Lock size={20} className="mb-2 drop-shadow-md" style={{ color: theme.timeColor || '#ffffff' }} />
      <h1 
        className="text-7xl font-light tracking-tight drop-shadow-sm"
        style={{ color: theme.timeColor || '#ffffff' }}
      >
        {formatTime(time)}
      </h1>
      <p 
        className="text-lg mt-1 font-medium drop-shadow-sm"
        style={{ color: theme.timeColor ? `${theme.timeColor}e6` : '#ffffffe6' }}
      >
        {formatDate(time)}
      </p>
      
      {/* Lock Screen Notifications */}
      <div className="w-full px-4 flex flex-col gap-2 z-50 mt-12">
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-lg flex items-center gap-3 border border-white/50"
          >
            <img src={personas?.find(p => p.id === notification.personaId)?.avatarUrl || personas?.[0]?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="avatar" />
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[14px] text-neutral-900">{notification.title}</span>
                <span className="text-[11px] text-neutral-500">现在</span>
              </div>
              <p className="text-[13px] text-neutral-600 truncate mt-0.5">{notification.body}</p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4">
        <div className="relative">
          <motion.button
            onClick={handleFingerprintClick}
            className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              isScanning ? 'border-blue-400 bg-blue-400/20' : scanComplete ? 'border-green-400 bg-green-400/20' : 'border-white/50 bg-white/10'
            } backdrop-blur-md shadow-lg`}
            animate={isScanning ? { scale: 1.1 } : { scale: 1 }}
          >
            <Fingerprint size={40} className={`${isScanning ? 'text-blue-400' : scanComplete ? 'text-green-400' : 'text-white'} transition-colors`} />
          </motion.button>
          
          {isScanning && (
            <svg className="absolute inset-0 w-20 h-20 -rotate-90 pointer-events-none">
              <motion.circle
                cx="40"
                cy="40"
                r="38"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="4"
                strokeDasharray="239"
                initial={{ strokeDashoffset: 239 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.5, ease: "linear" }}
              />
            </svg>
          )}
        </div>
        <span className="text-white text-sm font-medium drop-shadow-md">
          {isScanning ? '正在识别...' : scanComplete ? '识别成功' : '点击指纹解锁'}
        </span>
      </div>
    </motion.div>
  );
}
