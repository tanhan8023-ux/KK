import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, 
  ListMusic, Plus, Share, MoreHorizontal, Music, Trash2, FolderPlus, Folder, Users, X, Heart,
  Minimize2, Maximize2, Image as ImageIcon
} from 'lucide-react';
import { Song, Persona, Playlist, Message, ApiSettings, WorldbookSettings, UserProfile } from '../types';
import { fetchAiResponse } from '../services/aiService';
import { GoogleGenAI } from '@google/genai';

interface MusicScreenProps {
  onBack: () => void;
  songs: Song[];
  currentSongIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSelectSong: (index: number) => void;
  onAddSong: (song: Song, file: File) => void;
  onUpdateSong?: (songId: string, updates: Partial<Song>) => void;
  onDeleteSong?: (songId: string) => void;
  playlists: Playlist[];
  onAddSongToPlaylist: (songId: string, playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  listeningWithPersonaId?: string | null;
  listenStartTime?: number | null;
  onStartListeningWith: (personaId: string) => void;
  onStopListeningWith: () => void;
  personas: Persona[];
  userProfile?: UserProfile;
  onShareToChat?: (song: Song, personaId: string) => void;
  onShareToMoments?: (song: Song) => void;
  messages?: Message[];
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  apiSettings?: ApiSettings;
  worldbook?: WorldbookSettings;
  aiRef?: React.MutableRefObject<GoogleGenAI | null>;
}

const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80';

export function MusicScreen({
  onBack,
  songs,
  currentSongIndex,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onSelectSong,
  onAddSong,
  onUpdateSong,
  onDeleteSong,
  playlists,
  onAddSongToPlaylist,
  onCreatePlaylist,
  listeningWithPersonaId,
  listenStartTime,
  onStartListeningWith,
  onStopListeningWith,
  personas,
  userProfile,
  onShareToChat,
  onShareToMoments,
  messages = [],
  setMessages,
  apiSettings,
  worldbook,
  aiRef
}: MusicScreenProps) {
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'songs' | 'playlists'>('songs');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistSelectorForSong, setShowPlaylistSelectorForSong] = useState<string | null>(null);
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const currentSong = songs[currentSongIndex];
  const listeningWith = listeningWithPersonaId ? personas.find(p => p.id === listeningWithPersonaId) : null;
  const [listenDuration, setListenDuration] = useState('00:00');

  const [showChatMenu, setShowChatMenu] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Filter messages for the current listening session (exclude theater messages to match main chat)
  // Memoize to prevent re-calculation on every render (e.g. time updates)
  const chatMessages = React.useMemo(() => {
    return listeningWith ? messages.filter(m => m.personaId === listeningWith.id && !m.theaterId) : [];
  }, [messages, listeningWith?.id]);

  const [hasCheckedAiSkip, setHasCheckedAiSkip] = useState(false);

  // Reset skip check when song changes
  useEffect(() => {
    setHasCheckedAiSkip(false);
  }, [currentSong?.id]);

  // AI Auto-Skip Logic
  useEffect(() => {
    if (listeningWith && currentSong && isPlaying && currentTime > 10 && !hasCheckedAiSkip && setMessages && apiSettings && worldbook && aiRef && userProfile) {
      const checkAiSkip = async () => {
        setHasCheckedAiSkip(true); // Mark as checked immediately to prevent double calls
        
        // 10% chance to skip to make it less annoying, or higher if persona is picky?
        // Let's let the AI decide based on persona, but maybe throttle it?
        // Actually, let's just ask the AI.
        
        try {
          const prompt = `[系统提示：当前正在播放歌曲：${currentSong.title} - ${currentSong.artist}。你已经听了10秒。根据你的人设（${listeningWith.description}），你喜欢这首歌吗？你想切歌吗？
          如果非常不喜欢，或者觉得无聊，或者想捣乱，可以选择切歌。
          请务必只返回JSON格式，不要包含Markdown标记。格式：{"skip": boolean, "reason": "切歌理由/评价"}。
          切歌理由要符合你的人设口吻。如果不切歌，reason可以是简短的评价。]`;

          const { responseText } = await fetchAiResponse(
            prompt,
            [], 
            listeningWith,
            apiSettings,
            worldbook,
            userProfile,
            aiRef,
            false,
            "请务必只输出合法的JSON格式，不要包含Markdown代码块标记。"
          );

          let result;
          try {
             const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
             result = JSON.parse(jsonStr);
          } catch (e) {
             console.error("Failed to parse AI skip response", responseText);
             return;
          }

          if (result && result.skip) {
            // AI wants to skip
            onNext();
            
            // Send message explaining why
            const newMsg: Message = {
              id: Date.now().toString(),
              personaId: listeningWith.id,
              role: 'model',
              text: `(切歌) ${result.reason}`,
              msgType: 'text',
              timestamp: new Date().toLocaleTimeString(),
              createdAt: Date.now()
            };
            setMessages(prev => [...prev, newMsg]);
          } else if (result && result.reason && Math.random() > 0.7) {
            // 30% chance to just comment if not skipping
             const newMsg: Message = {
              id: Date.now().toString(),
              personaId: listeningWith.id,
              role: 'model',
              text: result.reason,
              msgType: 'text',
              timestamp: new Date().toLocaleTimeString(),
              createdAt: Date.now()
            };
            setMessages(prev => [...prev, newMsg]);
          }

        } catch (error) {
          console.error("AI Auto-skip check failed:", error);
        }
      };

      checkAiSkip();
    }
  }, [currentTime, listeningWith?.id, currentSong?.id, isPlaying]);

  // Auto-scroll chat
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  useEffect(() => {
    if (chatContainerRef.current && isNearBottomRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages.length, listeningWithPersonaId]);

  // Generate AI greeting when starting to listen together
  useEffect(() => {
    if (listeningWith && currentSong && setMessages && apiSettings && worldbook && aiRef && userProfile) {
      const sendGreeting = async () => {
        // Check if we already have messages in this session to avoid greeting again
        if (chatMessages.length > 0) return;

        setIsCommentaryLoading(true);
        try {
          const prompt = `[系统提示：用户刚刚邀请你一起听歌。当前播放的歌曲是：${currentSong.title} - ${currentSong.artist}。请根据你的人设（${listeningWith.description}），用你的口吻和性格，对用户说一句开场白。比如表达开心、对这首歌的看法，或者邀请用户一起享受音乐。保持简短自然，像微信聊天一样。]`;
          
          const { responseText } = await fetchAiResponse(
            prompt,
            [], // No context for greeting
            listeningWith,
            apiSettings,
            worldbook,
            userProfile,
            aiRef
          );

          const newMsg: Message = {
            id: Date.now().toString(),
            personaId: listeningWith.id,
            role: 'model',
            text: responseText,
            msgType: 'text',
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now()
          };
          
          setMessages(prev => [...prev, newMsg]);
        } catch (error) {
          console.error("Failed to generate greeting:", error);
        } finally {
          setIsCommentaryLoading(false);
        }
      };
      
      sendGreeting();
    }
  }, [listeningWith?.id]); // Only trigger when persona changes (starts listening)

  // Generate AI commentary when song changes
  useEffect(() => {
    if (listeningWith && currentSong && isPlaying && setMessages && apiSettings && worldbook && aiRef && userProfile) {
      const generateCommentary = async () => {
        // Check if we already have a commentary for this song recently to avoid spam
        const lastMsg = chatMessages[chatMessages.length - 1];
        // Don't generate commentary if the last message was just sent (e.g. the greeting)
        if (lastMsg && (Date.now() - (lastMsg.createdAt || 0) < 10000)) {
          return;
        }
        
        if (lastMsg && lastMsg.role === 'model' && lastMsg.text.includes(currentSong.title) && (Date.now() - (lastMsg.createdAt || 0) < 60000)) {
          return;
        }

        setIsCommentaryLoading(true);
        
        try {
          const prompt = `[系统提示：歌曲切换了。当前播放：${currentSong.title} - ${currentSong.artist}。请根据你的人设，发表一句简短评价或发起话题。]`;
          
          // Prepare context messages
          const contextMessages = chatMessages
            .slice(-10)
            .filter(m => m.text && m.text.trim() !== '') // Filter empty messages
            .map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: cleanContextMessage(m.text)
            }));

          const { responseText } = await fetchAiResponse(
            prompt,
            contextMessages,
            listeningWith,
            apiSettings,
            worldbook,
            userProfile,
            aiRef
          );

          const newMsg: Message = {
            id: Date.now().toString(),
            personaId: listeningWith.id,
            role: 'model',
            text: responseText,
            msgType: 'text',
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now()
          };
          
          setMessages(prev => [...prev, newMsg]);
        } catch (error) {
          console.error("Failed to generate commentary:", error);
        } finally {
          setIsCommentaryLoading(false);
        }
      };
      
      // Delay commentary to avoid conflict with greeting
      const timer = setTimeout(generateCommentary, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentSong?.id, listeningWith?.id]);

  useEffect(() => {
    if (!listenStartTime || !listeningWithPersonaId) {
      setListenDuration('00:00');
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - listenStartTime) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setListenDuration(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [listenStartTime, listeningWithPersonaId]);

  const filteredSongs = selectedPlaylistId 
    ? songs.filter(s => playlists.find(pl => pl.id === selectedPlaylistId)?.songIds.includes(s.id))
    : songs;

  const [parsedLyrics, setParsedLyrics] = useState<{time: number, text: string}[]>([]);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);

  // Parse lyrics when song changes
  useEffect(() => {
    if (currentSong?.lyrics) {
      const parsed = currentSong.lyrics.split('\n').map(line => {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (match) {
          return {
            time: parseInt(match[1]) * 60 + parseFloat(match[2]),
            text: match[3].trim()
          };
        }
        return null;
      }).filter((item): item is {time: number, text: string} => item !== null && item.text !== '');
      setParsedLyrics(parsed);
    } else {
      setParsedLyrics([]);
    }
  }, [currentSong?.id, currentSong?.lyrics]);

  // Update active lyric index
  useEffect(() => {
    if (parsedLyrics.length === 0) return;
    
    const index = parsedLyrics.findIndex((lyric, i) => {
      const nextLyric = parsedLyrics[i + 1];
      return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
    });

    if (index !== -1 && index !== activeLyricIndex) {
      setActiveLyricIndex(index);
    }
  }, [currentTime, parsedLyrics]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current && activeLyricIndex !== -1) {
      const activeElement = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyricIndex, showLyrics]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const url = URL.createObjectURL(file);
      
      let title = file.name.replace(/\.[^/.]+$/, "");
      let artist = "未知艺术家";
      
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      // Allow user to pick a cover image for the song
      const coverInput = document.createElement('input');
      coverInput.type = 'file';
      coverInput.accept = 'image/*';
      coverInput.onchange = (e: any) => {
        const coverFile = e.target.files?.[0];
        if (coverFile) {
          const coverUrl = URL.createObjectURL(coverFile);
          const newSong: Song = {
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            artist,
            cover: coverUrl,
            lyrics: '[00:00.00] 正在提取歌词中...\n[00:05.00] 点击封面可返回封面视图',
            url,
            source: 'local'
          };
          onAddSong(newSong, file);
        }
      };
      coverInput.click();
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
    }
  };

  const handleShare = () => {
    if (!currentSong) return;
    if (listeningWith && onShareToChat) {
      onShareToChat(currentSong, listeningWith.id);
    } else if (onShareToMoments) {
      onShareToMoments(currentSong);
    }
  };

  // Helper to clean messages for AI context (remove base64 images to save tokens)
  const cleanContextMessage = (text: string) => {
    // Replace [STICKER: data:...] with [STICKER: image]
    return text.replace(/\[STICKER:\s*data:[^\]]+\]/g, '[STICKER: image]');
  };

  const handleSendMessage = async (text: string) => {
    if (!listeningWith || !setMessages || !apiSettings || !worldbook || !aiRef || !userProfile) return;
    
    const newMsg: Message = {
      id: Date.now().toString(),
      personaId: listeningWith.id,
      role: 'user',
      text,
      msgType: 'text',
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
      status: 'sent',
      isRead: false
    };
    
    setMessages(prev => [...prev, newMsg]);
    setIsCommentaryLoading(true);

    try {
      // Prepare context messages (excluding the current one, as fetchAiResponse adds it)
      const contextMessages = chatMessages
        .slice(-10)
        .filter(m => m.text && m.text.trim() !== '')
        .map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: cleanContextMessage(m.text)
        }));

      // Add song context to system prompt implicitly via the prompt text if needed, 
      // or just rely on previous context. 
      // Better to reinforce the context:
      const prompt = text; 
      
      const additionalSystemInstructions = `[当前场景：用户正在和你一起听歌。当前播放：${currentSong.title} - ${currentSong.artist}。请结合歌曲氛围进行回复。]`;

      const { responseText } = await fetchAiResponse(
        prompt,
        contextMessages,
        listeningWith,
        apiSettings,
        worldbook,
        userProfile,
        aiRef,
        true,
        additionalSystemInstructions
      );

      // Mark user message as read
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, isRead: true, status: 'read' } : m));

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        personaId: listeningWith.id,
        role: 'model',
        text: responseText,
        msgType: 'text',
        timestamp: new Date().toLocaleTimeString(),
        createdAt: Date.now(),
        isRead: true
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Failed to generate reply:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        personaId: listeningWith.id,
        role: 'model',
        text: "(网络错误，请重试)",
        msgType: 'text',
        timestamp: new Date().toLocaleTimeString(),
        createdAt: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsCommentaryLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white font-sans relative overflow-hidden">
      {/* Background Blur */}
      <div 
        className="absolute inset-0 z-0 opacity-30 blur-2xl"
        style={{
          backgroundImage: `url(${customBg || currentSong?.cover || defaultCover})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-2 pt-12 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-widest uppercase text-white/50">
              {listeningWith ? `一起听 ${listeningWith.name}` : '正在播放'}
            </span>
            {listeningWith && (
              <button 
                onClick={onStopListeningWith}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="退出一起听"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {selectedPlaylistId && (
            <span className="text-[10px] text-white/30 mt-0.5">
              播放列表: {playlists.find(p => p.id === selectedPlaylistId)?.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowPersonaSelector(true)}
            className={`p-2 rounded-full transition-colors ${listeningWith ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/10 text-white'}`}
            title="选择AI一起听"
          >
            <Users className="w-6 h-6" />
          </button>
          <button 
            onClick={() => bgInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="自定义背景"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="导入音乐"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
        <input 
          type="file" 
          ref={bgInputRef} 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setCustomBg(URL.createObjectURL(file));
          }}
          accept="image/*"
          className="hidden"
        />
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="audio/*" 
          multiple 
          className="hidden" 
        />
      </div>

      {/* Main Content */}
      <div ref={constraintsRef} className="relative z-10 flex-1 flex flex-col items-center min-h-0 w-full overflow-hidden">
        {currentSong ? (
          <>
            {/* Listening Together Visualization (Heart & Red Lines) - Fixed at top */}
            {listeningWith && (
              <div className="w-full flex flex-col items-center py-2 shrink-0 bg-black/20 backdrop-blur-md z-20">
                <div className="relative flex items-center justify-center w-full max-w-[280px] h-16">
                  {/* Red Heart Rate Line with Animation */}
                  <div className="absolute top-1/2 left-[55px] right-[55px] h-16 -translate-y-1/2 z-0 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                      <motion.path 
                        d="M 0 20 L 70 20 L 75 10 L 80 30 L 85 5 L 90 20 L 110 20 L 115 5 L 120 35 L 125 0 L 130 20 L 200 20" 
                        stroke="rgba(239, 68, 68, 0.8)" 
                        strokeWidth="1.8" 
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{ 
                          d: isPlaying 
                            ? [
                                "M 0 20 L 70 20 L 75 10 L 80 30 L 85 5 L 90 20 L 110 20 L 115 5 L 120 35 L 125 0 L 130 20 L 200 20",
                                "M 0 20 L 70 20 L 75 12 L 80 28 L 85 8 L 90 20 L 110 20 L 115 8 L 120 32 L 125 3 L 130 20 L 200 20",
                                "M 0 20 L 70 20 L 75 10 L 80 30 L 85 5 L 90 20 L 110 20 L 115 5 L 120 35 L 125 0 L 130 20 L 200 20"
                              ]
                            : "M 0 20 L 200 20"
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 0.8,
                          ease: "easeInOut"
                        }}
                      />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between w-full px-8 relative z-10">
                    {/* User Avatar */}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full border-2 border-white/80 p-0.5 shadow-[0_0_15px_rgba(255,255,255,0.15)] bg-black/40 relative z-10 bg-[#1a1a1a]">
                        <img 
                          src={userProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.name || 'User'}`} 
                          alt="Me" 
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isPlaying && (
                          <div className="absolute -inset-1.5 rounded-full border border-white/30 animate-ping opacity-20" />
                        )}
                      </div>
                    </div>

                    {/* Beating Heart on the Line */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                      <motion.div
                        animate={{ 
                          scale: isPlaying ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 0.8,
                          ease: "easeInOut"
                        }}
                        className="bg-[#0a0a0a] rounded-full p-1"
                      >
                        <Heart className="w-4 h-4 text-red-500 fill-current" />
                      </motion.div>
                    </div>

                    {/* AI Avatar */}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full border-2 border-white/80 p-0.5 shadow-[0_0_15px_rgba(255,255,255,0.15)] bg-black/40 relative z-10 bg-[#1a1a1a]">
                        <img 
                          src={listeningWith?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listeningWith?.name || 'AI'}`} 
                          alt={listeningWith?.name || 'AI'} 
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isPlaying && (
                          <div className="absolute -inset-1.5 rounded-full border border-white/30 animate-ping opacity-20" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Duration Text */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-1"
                >
                  <p className="text-[10px] font-medium text-white/60 tracking-widest uppercase font-mono">
                    一起听了 {listenDuration}
                  </p>
                </motion.div>
              </div>
            )}

            {/* Scrollable Content Wrapper */}
            <div className="flex-1 w-full overflow-y-auto scrollbar-hide flex flex-col items-center py-8">

              {/* Album Art with Vinyl Effect */}
              <div className={`relative aspect-square group transition-all duration-500 shrink-0 ${listeningWith && !showLyrics ? 'w-48 mb-4' : 'w-full max-w-[320px] mb-8'} ${showLyrics ? 'h-[400px] max-w-none w-[90%]' : ''}`}>
                {/* Vinyl Record */}
                {!showLyrics && (
                  <div 
                    className={`absolute top-0 right-[-15%] w-full h-full rounded-full bg-[#111] shadow-2xl border-[6px] border-black/40 flex items-center justify-center overflow-hidden animate-[spin_10s_linear_infinite]`}
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                  >
                    <div className="w-full h-full opacity-30 bg-[repeating-radial-gradient(circle,transparent,transparent_2px,rgba(255,255,255,0.05)_3px)]" />
                    <div className="absolute w-12 h-12 rounded-full bg-black/80 border border-white/10" />
                  </div>
                )}

                {/* Cover Art */}
                <div 
                  className={`relative z-10 w-full h-full rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer transition-all duration-500 ${showLyrics ? 'bg-black/40 backdrop-blur-2xl border border-white/10' : ''}`}
                  onClick={() => setShowLyrics(!showLyrics)}
                >
                  <AnimatePresence mode="wait">
                    {!showLyrics ? (
                      <motion.img 
                        key="artwork"
                        src={currentSong.cover || defaultCover} 
                        alt={currentSong.title}
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <motion.div 
                        key="lyrics"
                        className="w-full h-full p-6 flex flex-col items-center justify-center text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div ref={lyricsContainerRef} className="w-full h-full overflow-y-auto scrollbar-hide py-32 relative">
                          {parsedLyrics.length > 0 ? (
                            parsedLyrics.map((line, i) => {
                              const isActive = i === activeLyricIndex;
                              return (
                                <p 
                                  key={i} 
                                  className={`text-sm mb-6 transition-all duration-500 ${isActive ? 'text-white font-bold scale-125 active-lyric' : 'text-white/20'}`}
                                >
                                  {line.text}
                                </p>
                              );
                            })
                          ) : <p className="text-white/40 italic text-sm">暂无歌词</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>


            </div>

            {/* Music Card (Light Glassy Style) - Fixed at bottom */}
            <div className="w-full bg-white/95 backdrop-blur-3xl rounded-[32px] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.3)] border border-white/20 shrink-0 relative z-30">
              {/* Song Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-lg font-bold text-neutral-900 truncate leading-tight">{currentSong.title}</h2>
                  <p className="text-sm text-neutral-500 font-medium truncate mt-0.5">{currentSong.artist}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPlaylistSelectorForSong(currentSong.id)} className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors bg-neutral-100 rounded-full">
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <button onClick={handleShare} className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors bg-neutral-100 rounded-full">
                    <Share className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full mb-4">
                <div 
                  className="h-1.5 w-full bg-neutral-200 rounded-full cursor-pointer relative overflow-hidden"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onSeek(((e.clientX - rect.left) / rect.width) * duration);
                  }}
                >
                  <motion.div 
                    className="h-full bg-neutral-900 rounded-full"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-bold text-neutral-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Centered Controls */}
              <div className="relative flex items-center justify-center w-full h-16">
                {/* Left Button */}
                <button 
                  onClick={() => setShowPlaylist(true)} 
                  className="absolute left-0 p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                >
                  <ListMusic className="w-6 h-6" />
                </button>

                {/* Center Group */}
                <div className="flex items-center gap-8">
                  <button onClick={onPrev} className="p-2 text-neutral-700 hover:text-neutral-900 transition-transform active:scale-90">
                    <SkipBack className="w-7 h-7 fill-current" />
                  </button>
                  
                  <button 
                    onClick={onPlayPause}
                    className="w-16 h-16 flex items-center justify-center bg-neutral-900 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all z-30"
                  >
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </button>
                  
                  <button onClick={onNext} className="p-2 text-neutral-700 hover:text-neutral-900 transition-transform active:scale-90">
                    <SkipForward className="w-7 h-7 fill-current" />
                  </button>
                </div>

                {/* Right Button */}
                <button className="absolute right-0 p-2 text-neutral-400 hover:text-neutral-900 transition-colors">
                  <MoreHorizontal className="w-6 h-6" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-white/40 h-full">
            <Music className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无歌曲</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium transition-colors"
            >
              导入本地音乐
            </button>
          </div>
        )}
      </div>

      {/* Playlist Drawer */}
      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlaylist(false)}
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="absolute bottom-0 left-0 right-0 z-50 h-[75vh] bg-[#121212] rounded-t-3xl flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="p-6 pb-2 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">音乐库</h3>
                  <button 
                    onClick={() => setShowPlaylist(false)}
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setDrawerTab('songs')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${drawerTab === 'songs' ? 'text-white border-white' : 'text-white/40 border-transparent'}`}
                  >
                    所有歌曲
                  </button>
                  <button 
                    onClick={() => setDrawerTab('playlists')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${drawerTab === 'playlists' ? 'text-white border-white' : 'text-white/40 border-transparent'}`}
                  >
                    歌单
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {drawerTab === 'songs' ? (
                  <div className="space-y-2">
                    {filteredSongs.length === 0 ? (
                      <div className="text-center py-10 text-white/40">
                        {selectedPlaylistId ? "歌单为空" : "未找到歌曲"}
                      </div>
                    ) : (
                      filteredSongs.map((song, index) => {
                        const originalIndex = songs.findIndex(s => s.id === song.id);
                        return (
                          <div 
                            key={song.id}
                            onClick={() => {
                              onSelectSong(originalIndex);
                              setShowPlaylist(false);
                            }}
                            className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${
                              originalIndex === currentSongIndex ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <img 
                              src={song.cover || defaultCover} 
                              alt={song.title} 
                              className="w-12 h-12 rounded-lg object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-base font-medium truncate ${originalIndex === currentSongIndex ? 'text-white' : 'text-white/90'}`}>
                                {song.title}
                              </h4>
                              <p className="text-sm text-white/50 truncate">{song.artist}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {song.source === 'local' && onUpdateSong && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (ev: any) => {
                                      const file = ev.target.files?.[0];
                                      if (file) {
                                        const url = URL.createObjectURL(file);
                                        onUpdateSong(song.id, { cover: url });
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="p-2 text-white/20 hover:text-white transition-colors"
                                  title="修改封面"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPlaylistSelectorForSong(song.id);
                                }}
                                className="p-2 text-white/20 hover:text-white transition-colors"
                              >
                                <FolderPlus className="w-4 h-4" />
                              </button>
                              {originalIndex === currentSongIndex && isPlaying ? (
                                <div className="flex gap-1 items-end h-4 px-2">
                                  <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white rounded-full" />
                                  <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-white rounded-full" />
                                  <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-white rounded-full" />
                                </div>
                              ) : (
                                song.source === 'local' && onDeleteSong && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSong(song.id);
                                    }}
                                    className="p-2 text-white/20 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setShowCreatePlaylist(true)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-dashed border-white/10"
                    >
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white/40" />
                      </div>
                      <span className="font-medium">新建歌单</span>
                    </button>

                    <div 
                      onClick={() => {
                        setSelectedPlaylistId(null);
                        setDrawerTab('songs');
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors ${!selectedPlaylistId ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <Music className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">所有歌曲</h4>
                        <p className="text-sm text-white/40">{songs.length} 首歌曲</p>
                      </div>
                    </div>

                    {playlists.map(pl => (
                      <div 
                        key={pl.id}
                        onClick={() => {
                          setSelectedPlaylistId(pl.id);
                          setDrawerTab('songs');
                        }}
                        className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors ${selectedPlaylistId === pl.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Folder className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{pl.name}</h4>
                          <p className="text-sm text-white/40">{pl.songIds.length} 首歌曲</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Playlist Dialog */}
      <AnimatePresence>
        {showCreatePlaylist && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowCreatePlaylist(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] rounded-3xl p-6 shadow-2xl border border-white/10"
            >
              <h3 className="text-xl font-semibold mb-4">新建歌单</h3>
              <input 
                autoFocus
                type="text"
                placeholder="歌单名称"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-white/20"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCreatePlaylist(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleCreatePlaylist}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add to Playlist Selector */}
      <AnimatePresence>
        {showPlaylistSelectorForSong && (
          <div className="absolute inset-0 z-[100] flex items-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPlaylistSelectorForSong(null)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full bg-[#1a1a1a] rounded-t-3xl p-6 shadow-2xl border-t border-white/10 max-h-[60vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">添加到歌单</h3>
                <button onClick={() => setShowPlaylistSelectorForSong(null)}>
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-6">
                {playlists.map(pl => (
                  <button 
                    key={pl.id}
                    onClick={() => {
                      onAddSongToPlaylist(showPlaylistSelectorForSong, pl.id);
                      setShowPlaylistSelectorForSong(null);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Folder className="w-5 h-5 text-white/40" />
                    <span className="font-medium">{pl.name}</span>
                  </button>
                ))}
                <button 
                  onClick={() => {
                    setShowPlaylistSelectorForSong(null);
                    setShowCreatePlaylist(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-dashed border-white/10"
                >
                  <Plus className="w-5 h-5 text-white/40" />
                  <span className="font-medium">新建歌单</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persona Selector for Listen Together */}
      <AnimatePresence>
        {showPersonaSelector && (
          <div className="absolute inset-0 z-[110] flex items-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPersonaSelector(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full bg-[#1a1a1a] rounded-t-3xl p-6 shadow-2xl border-t border-white/10 max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">选择 AI 一起听</h3>
                <button onClick={() => setShowPersonaSelector(false)}>
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                {personas.map(persona => (
                  <button 
                    key={persona.id}
                    onClick={() => {
                      onStartListeningWith(persona.id);
                      setShowPersonaSelector(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      listeningWithPersonaId === persona.id 
                        ? 'bg-indigo-500/20 border border-indigo-500/30' 
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <img 
                      src={persona.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${persona.name}`} 
                      alt={persona.name}
                      className="w-12 h-12 rounded-full object-cover bg-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-white">{persona.name}</h4>
                      <p className="text-xs text-white/40 line-clamp-1">{persona.instructions.substring(0, 50)}...</p>
                    </div>
                    {listeningWithPersonaId === persona.id && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
              {listeningWithPersonaId && (
                <button 
                  onClick={() => {
                    onStopListeningWith();
                    setShowPersonaSelector(false);
                  }}
                  className="w-full py-4 mt-2 rounded-2xl bg-red-500/10 text-red-500 font-semibold hover:bg-red-500/20 transition-colors"
                >
                  停止一起听
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
