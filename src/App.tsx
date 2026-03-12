import React, { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { Phone } from './components/Phone';
import { HomeScreen } from './components/HomeScreen';
import { PersonaScreen } from './components/PersonaScreen';
import { ApiSettingsScreen } from './components/ApiSettingsScreen';
import { ChatScreen } from './components/ChatScreen';
import { LockScreen } from './components/LockScreen';
import { ThemeSettingsScreen } from './components/ThemeSettingsScreen';
import { MusicScreen } from './components/MusicScreen';
import { XHSScreen } from './components/XHSScreen';
import { TreeHoleScreen } from './components/TreeHoleScreen';
import { TaobaoScreen } from './components/TaobaoScreen';
import { FoodDeliveryScreen } from './components/FoodDeliveryScreen';
import { BartenderGame } from './components/BartenderGame';
import { AiPhonesScreen } from './components/AiPhonesScreen';
import { ChatBubble } from './components/ChatBubble';

const ChatBubbleWrapper = React.memo(({
  listeningWith,
  messages,
  isMinimized,
  setIsMinimized,
  userProfile,
  handleSendMessage,
  isCommentaryLoading,
  setListeningWithPersonaId
}: any) => {
  const chatMessages = React.useMemo(() => {
    return messages.filter((m: any) => m.personaId === listeningWith.id && !m.theaterId);
  }, [messages, listeningWith.id]);

  const onSend = React.useCallback((text: string) => {
    handleSendMessage(text, listeningWith.id);
  }, [handleSendMessage, listeningWith.id]);

  const onClose = React.useCallback(() => {
    setListeningWithPersonaId(undefined);
  }, [setListeningWithPersonaId]);

  return (
    <ChatBubble
      listeningWith={listeningWith}
      chatMessages={chatMessages}
      isMinimized={isMinimized}
      setIsMinimized={setIsMinimized}
      userProfile={userProfile}
      handleSendMessage={onSend}
      isCommentaryLoading={isCommentaryLoading}
      onClose={onClose}
    />
  );
});

import { LoveWidgetScreen } from './components/LoveWidgetScreen';
import { PhotoAlbumScreen } from './components/PhotoAlbumScreen';
import { WeatherScreen } from './components/WeatherScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { NotesScreen } from './components/NotesScreen';
import { WalletScreen } from './components/WalletScreen';
import { CalculatorScreen } from './components/CalculatorScreen';
import { CameraScreen } from './components/CameraScreen';
import { Screen, Persona, UserProfile, ApiSettings, ThemeSettings, Message, Moment, Song, WorldbookSettings, XHSPost, TreeHolePost, TreeHoleNotification, TreeHoleMessage, Order, Playlist, DiaryEntry } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { storageService } from './services/storageService';
import { fetchAiResponse, generatePersonaStatus, checkIfPersonaIsOffline, generateUserRemark, generateDiaryEntry } from './services/aiService';
import { lyricService } from './services/lyricService';
import { repairJson } from './utils';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const generatingDiariesRef = useRef<Set<string>>(new Set());
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };
  const [importProgress, setImportProgress] = useState(0);
  const [isLocked, setIsLocked] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);
  const [listeningWithPersonaId, setListeningWithPersonaId] = useState<string | undefined>(undefined);
  const [listenStartTime, setListenStartTime] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAiPhoneOpen, setIsAiPhoneOpen] = useState(false);
  
  // Music Player State
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (listeningWithPersonaId) {
      setListenStartTime(Date.now());
    } else {
      setListenStartTime(null);
    }
  }, [listeningWithPersonaId]);

  // Load songs on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedSongs, storedPlaylists] = await Promise.all([
          storageService.loadAllSongs(),
          storageService.loadPlaylists()
        ]);

        if (storedSongs.length > 0) {
          setSongs(storedSongs);
        } else {
          setSongs([]);
        }

        if (storedPlaylists.length > 0) {
          setPlaylists(storedPlaylists);
        } else {
          setPlaylists([
            { id: 'default', name: '我的收藏', songIds: [], createdAt: Date.now() }
          ]);
        }
      } catch (e) {
        console.error("Failed to load music data:", e);
      }
    };
    loadData();
  }, []);

  const currentSong = songs[currentSongIndex];

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Play error:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    handleNextSong();
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNextSong = () => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev + 1) % songs.length);
    setIsPlaying(true);
  };

  const handlePrevSong = () => {
    setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleAddSong = async (newSong: Song, file: File) => {
    // Optimistic update
    setSongs(prev => {
      const newSongs = [...prev, newSong];
      setCurrentSongIndex(newSongs.length - 1);
      return newSongs;
    });
    setIsPlaying(true);

    // Save initial metadata
    await storageService.saveSong(newSong, file);

    // Extract lyrics in background
    try {
      const lyrics = await lyricService.extractLyrics(newSong.title, newSong.artist, apiSettings);
      const updatedSong = { ...newSong, lyrics };
      
      setSongs(prev => prev.map(s => s.id === newSong.id ? updatedSong : s));
      await storageService.saveSong(updatedSong, file);
    } catch (e) {
      console.error("Lyric extraction failed:", e);
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<Song>) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  };

  const handleCreatePlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      songIds: [],
      createdAt: Date.now()
    };
    setPlaylists(prev => {
      const updated = [...prev, newPlaylist];
      storageService.savePlaylists(updated);
      return updated;
    });
  };

  const handleAddSongToPlaylist = (songId: string, playlistId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          if (pl.songIds.includes(songId)) return pl;
          return { ...pl, songIds: [...pl.songIds, songId] };
        }
        return pl;
      });
      storageService.savePlaylists(updated);
      return updated;
    });
  };

  const handleSelectSong = (index: number) => {
    setCurrentSongIndex(index);
    setIsPlaying(true);
  };

  const handleDeleteSong = (songId: string) => {
    setSongs(prev => {
      const updated = prev.filter(s => s.id !== songId);
      if (currentSongIndex >= updated.length) {
        setCurrentSongIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
    storageService.deleteSong(songId).catch(e => console.error("Failed to delete song:", e));
  };

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '我',
    avatarUrl: '',
    anniversaryDate: ''
  });

  const [personas, setPersonas] = useState<Persona[]>([{
    id: 'p1',
    name: '猫娘',
    instructions: '你是一只可爱的猫娘，说话句尾要带“喵~”。你很粘人，喜欢撒娇。',
    prompt: '请保持猫娘的语气，每次回复不要超过50个字。',
    prompts: []
  }]);

  const listeningWith = listeningWithPersonaId ? personas.find(p => p.id === listeningWithPersonaId) : null;

  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    apiUrl: '',
    apiKey: '',
    model: 'gemini-3-flash-preview',
    voiceModel: '',
    voiceApiUrl: '',
    voiceApiKey: '',
    voiceParams: '',
    asrModel: '',
    asrApiUrl: '',
    asrApiKey: '',
    asrParams: '',
    temperature: 0.85,
  });

  const [theme, setTheme] = useState<ThemeSettings>({
    wallpaper: '',
    lockScreenWallpaper: '',
    momentsBg: '',
    iconBgColor: 'rgba(255, 255, 255, 0.9)',
    fontUrl: '',
    timeColor: '#ffffff',
    statusColor: '#ffffff',
    customIcons: {},
    musicPlayer: {
      title: '想变成你的随身听...',
      avatar1: 'https://picsum.photos/seed/avatar1/100/100',
      avatar2: 'https://picsum.photos/seed/avatar2/100/100'
    }
  });

  const [worldbook, setWorldbook] = useState<WorldbookSettings>({
    jailbreakPrompt: '',
    globalPrompt: '',
    jailbreakPrompts: [],
    globalPrompts: []
  });

  // Lifted State
  const [messages, setMessages] = useState<Message[]>([]);
  const [moments, setMoments] = useState<Moment[]>([{
    id: 'm1',
    authorId: 'p1',
    text: '今天天气真好呀，想和你一起去散步~ 🐾 记得多穿点衣服哦！',
    timestamp: '1小时前',
    likedByIds: ['user'],
    comments: []
  }]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<{title: string, body: string, personaId?: string} | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [followedAuthorIds, setFollowedAuthorIds] = useState<string[]>(['p1']);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<string[]>([]);
  const [xhsPrivateChats, setXhsPrivateChats] = useState<Record<string, { text: string, isMe: boolean, time: number }[]>>({
    'p1': [
      { text: '你好呀喵~ 看到你关注我了，好开心喵！', isMe: false, time: Date.now() - 3600000 }
    ]
  });
  const [treeHolePrivateChats, setTreeHolePrivateChats] = useState<Record<string, TreeHoleMessage[]>>({});
  const [treeHolePersonas, setTreeHolePersonas] = useState<Persona[]>([]);
  const [treeHolePosts, setTreeHolePosts] = useState<TreeHolePost[]>([
    {
      id: 'th1',
      authorId: 'th_npc_1',
      authorName: '匿名小猫',
      authorAvatar: 'https://picsum.photos/seed/th1/100/100',
      content: '今天的心情就像这天气一样，阴沉沉的。有人愿意听听我的故事吗？',
      likes: 12,
      comments: [
        {
          id: 'thc-init-1',
          authorId: 'th_npc_init_1',
          authorName: '路过的风',
          authorAvatar: 'https://picsum.photos/seed/wind/100/100',
          text: '抱抱你，愿意做你的树洞。',
          likes: 3,
          createdAt: Date.now() - 3500000,
        },
        {
          id: 'thc-init-2',
          authorId: 'th_npc_init_2',
          authorName: '温暖的太阳',
          authorAvatar: 'https://picsum.photos/seed/sun/100/100',
          text: '一切都会好起来的！',
          likes: 5,
          createdAt: Date.now() - 3400000,
        }
      ],
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'th2',
      authorId: 'th_npc_2',
      authorName: '忧郁的云',
      authorAvatar: 'https://picsum.photos/seed/th2/100/100',
      content: '如果时间可以倒流，我一定会选择在那天勇敢一点。',
      likes: 45,
      comments: [
        {
          id: 'thc-init-3',
          authorId: 'th_npc_init_3',
          authorName: '时光机',
          authorAvatar: 'https://picsum.photos/seed/time/100/100',
          text: '可惜没有如果，向前看吧。',
          likes: 8,
          createdAt: Date.now() - 7100000,
        }
      ],
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'th3',
      authorId: 'th_npc_3',
      authorName: '深海里的鱼',
      authorAvatar: 'https://picsum.photos/seed/th3/100/100',
      content: '在大城市里打拼，有时候真的觉得好累。但看到窗外的灯火，又觉得还有希望。',
      likes: 89,
      comments: [],
      createdAt: Date.now() - 10800000,
    }
  ]);
  const [treeHoleNotifications, setTreeHoleNotifications] = useState<TreeHoleNotification[]>([]);
  const [xhsPosts, setXhsPosts] = useState<XHSPost[]>([
    {
      id: 'xhs1',
      authorId: 'p1',
      authorName: '猫娘',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      title: '今日份的可爱，请查收！🐱',
      content: '今天穿了新裙子喵~ 感觉自己萌萌哒！大家觉得好看吗？',
      images: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80'],
      likes: 520,
      comments: 2,
      commentsList: [
        { id: 'c1', authorName: '路人甲', authorAvatar: 'https://picsum.photos/seed/user1/100/100', text: '太可爱了喵！', createdAt: Date.now() - 1800000 },
        { id: 'c2', authorName: '学霸学长', authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80', text: '裙子很适合你。', createdAt: Date.now() - 900000 }
      ],
      createdAt: Date.now() - 3600000
    },
    {
      id: 'xhs2',
      authorId: 'p1',
      authorName: '猫娘',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      title: '周末去哪儿玩喵？求推荐！✨',
      content: '想去有好吃的小鱼干的地方喵~ 最好还有暖暖的太阳可以晒。',
      images: ['https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=800&q=80'],
      likes: 1314,
      comments: 0,
      commentsList: [],
      createdAt: Date.now() - 7200000
    },
    {
      id: 'xhs3',
      authorId: 'npc1',
      authorName: '学霸学长',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
      title: '图书馆的午后，静谧而充实。📖',
      content: '最近在钻研量子力学，感觉宇宙的奥秘真是无穷无尽。有人一起组队学习吗？',
      images: ['https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=800&q=80'],
      likes: 88,
      comments: 1,
      commentsList: [
        { id: 'c3', authorName: '元气少女', authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80', text: '学长带带我！', createdAt: Date.now() - 300000 }
      ],
      createdAt: Date.now() - 14400000
    },
    {
      id: 'xhs4',
      authorId: 'npc2',
      authorName: '元气少女',
      authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80',
      title: '今天也要元气满满哦！☀️',
      content: '早起跑了5公里，出汗的感觉太棒了！大家也要记得多运动呀~',
      images: ['https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80'],
      likes: 256,
      comments: 0,
      commentsList: [],
      createdAt: Date.now() - 21600000
    }
  ]);

  // Initialization
  useEffect(() => {
    const loadAll = async () => {
      try {
        const migrate = async (key: string, setter: any) => {
          let val = await localforage.getItem(key);
          if (!val) {
            const lsVal = localStorage.getItem(key);
            if (lsVal) {
              try {
                val = JSON.parse(lsVal);
                await localforage.setItem(key, val);
              } catch (e) {}
            }
          }
          if (val) setter(val);
        };

        await Promise.all([
          migrate('userProfile', setUserProfile),
          migrate('personas', setPersonas),
          migrate('apiSettings', setApiSettings),
          migrate('worldbook', setWorldbook),
          migrate('messages', setMessages),
          migrate('moments', setMoments),
          migrate('xhsPosts', setXhsPosts),
          migrate('xhsPrivateChats', setXhsPrivateChats),
          migrate('treeHolePrivateChats', setTreeHolePrivateChats),
          migrate('treeHolePersonas', setTreeHolePersonas),
          migrate('treeHolePosts', setTreeHolePosts),
          migrate('treeHoleNotifications', setTreeHoleNotifications),
          migrate('followedAuthorIds', setFollowedAuthorIds),
          migrate('blockedAuthorIds', setBlockedAuthorIds),
          migrate('orders', setOrders),
        ]);

        // Handle theme separately to load font blob
        let themeVal = await localforage.getItem<ThemeSettings>('theme');
        if (!themeVal) {
          const lsVal = localStorage.getItem('theme');
          if (lsVal) {
            try {
              themeVal = JSON.parse(lsVal);
              await localforage.setItem('theme', themeVal);
            } catch (e) {}
          }
        }
        if (themeVal) {
          try {
            const fontBlob = await localforage.getItem<Blob>('themeFontBlob');
            if (fontBlob) {
              themeVal.fontUrl = URL.createObjectURL(fontBlob);
            }
          } catch (e) {
            console.error("Failed to load font blob", e);
          }
          setTheme(themeVal);
        }
      } catch (e) {
        console.error("Failed to load state", e);
      } finally {
        setIsReady(true);
      }
    };
    loadAll();
  }, []);

  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const debouncedSave = (key: string, value: any) => {
    if (!isReady) return;
    if (saveTimeouts.current[key]) clearTimeout(saveTimeouts.current[key]);
    saveTimeouts.current[key] = setTimeout(async () => {
      try {
        await localforage.setItem(key, value);
      } catch (e) {
        console.error(`Failed to save ${key} to localforage:`, e);
      }
    }, 500);
  };

  useEffect(() => { debouncedSave('userProfile', userProfile); }, [userProfile, isReady]);
  useEffect(() => { debouncedSave('personas', personas); }, [personas, isReady]);
  useEffect(() => { debouncedSave('apiSettings', apiSettings); }, [apiSettings, isReady]);
  useEffect(() => { debouncedSave('theme', theme); }, [theme, isReady]);
  useEffect(() => { debouncedSave('worldbook', worldbook); }, [worldbook, isReady]);
  useEffect(() => { debouncedSave('messages', messages); }, [messages, isReady]);
  useEffect(() => { debouncedSave('moments', moments); }, [moments, isReady]);
  useEffect(() => { debouncedSave('xhsPosts', xhsPosts); }, [xhsPosts, isReady]);
  useEffect(() => { debouncedSave('xhsPrivateChats', xhsPrivateChats); }, [xhsPrivateChats, isReady]);
  useEffect(() => { debouncedSave('treeHolePrivateChats', treeHolePrivateChats); }, [treeHolePrivateChats, isReady]);
  useEffect(() => { debouncedSave('treeHolePersonas', treeHolePersonas); }, [treeHolePersonas, isReady]);
  useEffect(() => { debouncedSave('treeHolePosts', treeHolePosts); }, [treeHolePosts, isReady]);
  useEffect(() => { debouncedSave('treeHoleNotifications', treeHoleNotifications); }, [treeHoleNotifications, isReady]);
  useEffect(() => { debouncedSave('followedAuthorIds', followedAuthorIds); }, [followedAuthorIds, isReady]);
  useEffect(() => { debouncedSave('blockedAuthorIds', blockedAuthorIds); }, [blockedAuthorIds, isReady]);
  useEffect(() => { debouncedSave('orders', orders); }, [orders, isReady]);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const prevMessagesLength = useRef(messages.length);
  const isFirstRunAfterReady = useRef(true);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (isFirstRunAfterReady.current) {
      prevMessagesLength.current = messages.length;
      isFirstRunAfterReady.current = false;
      return;
    }

    if (messages.length > prevMessagesLength.current) {
      const newMessages = messages.slice(prevMessagesLength.current);
      // Only count messages that are NOT theater messages
      const newAiMessages = newMessages.filter(m => m.role === 'model' && !m.theaterId);
      
      if (newAiMessages.length > 0) {
        const lastMsg = newAiMessages[newAiMessages.length - 1];
        if (currentScreen !== 'chat' || isLocked || currentChatId !== lastMsg.personaId) {
          setUnreadCount(prev => prev + newAiMessages.length);
          setNotification({ 
            title: personas.find(p => p.id === lastMsg.personaId)?.name || 'AI', 
            body: lastMsg.text,
            personaId: lastMsg.personaId
          });
          
          if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
          }
          notificationTimeoutRef.current = setTimeout(() => setNotification(null), 4000);
        }
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, currentScreen, isLocked, personas, isReady]);

  // Mark messages as read when in chat
  useEffect(() => {
    if (currentScreen === 'chat' && currentChatId && !isLocked) {
      setMessages(prev => {
        const hasUnread = prev.some(m => m.personaId === currentChatId && m.role === 'model' && !m.isRead);
        if (hasUnread) {
          return prev.map(m => 
            m.personaId === currentChatId && m.role === 'model' && !m.isRead 
              ? { ...m, isRead: true } 
              : m
          );
        }
        return prev;
      });
      setUnreadCount(0);
    }
  }, [currentScreen, currentChatId, isLocked]);

  // Silence Detection (Read but no reply)
  useEffect(() => {
    // Cleanup previous timer
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (!isReady || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    
    // Condition: Last message is from AI, and it IS READ by the user.
    // (User read it, but hasn't replied)
    if (lastMsg.role === 'model' && !lastMsg.theaterId && lastMsg.isRead) {
      
      // If we are currently in the chat screen with this persona, let ChatScreen handle the pestering
      if (currentScreen === 'chat' && currentChatId === lastMsg.personaId) return;

      const persona = personas.find(p => p.id === lastMsg.personaId);
      if (!persona) return;

      // Define delay. For demo: 3m - 3m 10s.
      const delay = 180000 + Math.random() * 10000; 

      silenceTimeoutRef.current = setTimeout(() => {
        handleSilenceCheck(persona, lastMsg.id);
      }, delay);
    }
  }, [messages, isReady, currentScreen, currentChatId]);

  // Autonomous Status Update
  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(async () => {
      if (personas.length === 0) return;
      const randomPersona = personas[Math.floor(Math.random() * personas.length)];
      
      try {
        const newStatus = await generatePersonaStatus(
          randomPersona,
          apiSettings,
          worldbook,
          userProfile,
          { current: null } // Dummy ref
        );
        const isOffline = await checkIfPersonaIsOffline(randomPersona, apiSettings, worldbook, userProfile, { current: null });
        
        // Also update user remark
        const newUserRemark = await generateUserRemark(
          randomPersona,
          apiSettings,
          worldbook,
          userProfile,
          { current: null }
        );

        setPersonas(prev => prev.map(p => p.id === randomPersona.id ? { 
          ...p, 
          statusMessage: newStatus, 
          isOffline,
          aiPhoneSettings: {
            ...(p.aiPhoneSettings || {}),
            userRemark: newUserRemark
          }
        } : p));
      } catch (e) {
        console.error("Failed to generate autonomous status:", e);
      }
      
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [personas, apiSettings, worldbook, userProfile, isReady]);

  // Autonomous Diary Generation
  useEffect(() => {
    if (!isReady) return;
    
    const checkAndGenerateDiaries = async () => {
      const today = new Date().toLocaleDateString('zh-CN');
      
      for (const persona of personas) {
        // Check if diary exists for today
        const entries = persona.diaryEntries || [];
        const hasTodayEntry = entries.some(entry => {
          const entryDate = new Date(entry.timestamp).toLocaleDateString('zh-CN');
          return entryDate === today;
        });
        
        if (!hasTodayEntry && !generatingDiariesRef.current.has(persona.id)) {
          generatingDiariesRef.current.add(persona.id);
          try {
            if (!aiRef.current) {
              aiRef.current = new GoogleGenAI({ apiKey: apiSettings.apiKey || undefined || process.env.GEMINI_API_KEY as string });
            }
            
            const entryData = await generateDiaryEntry(persona, apiSettings, worldbook, userProfile, aiRef as any);
            const newEntry: DiaryEntry = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              title: entryData.title || '无题',
              content: entryData.content,
              mood: entryData.mood,
              moodLabel: entryData.moodLabel,
              weather: entryData.weather
            };
            
            setPersonas(prev => prev.map(p => {
              if (p.id === persona.id) {
                const currentEntries = p.diaryEntries || [];
                return {
                  ...p,
                  diaryEntries: [newEntry, ...currentEntries]
                };
              }
              return p;
            }));
            
          } catch (e) {
            console.error(`Failed to generate diary for ${persona.name}:`, e);
          } finally {
            generatingDiariesRef.current.delete(persona.id);
          }
        }
      }
    };

    // Check immediately on load
    checkAndGenerateDiaries();
    
    // Then check every hour
    const interval = setInterval(checkAndGenerateDiaries, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [personas, apiSettings, worldbook, userProfile, isReady]);

  // Background message simulator
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length === 0 && personas.length > 0) {
        const firstPersona = personas[0];
        if (firstPersona.allowActiveMessaging === true) {
          const msgText = `主人，你在干嘛呀？快来陪我聊天喵~`;
          const newMsg: Message = { id: Date.now().toString(), personaId: firstPersona.id, role: 'model', text: msgText };
          setMessages(prev => [...prev, newMsg]);
        }
      }
    }, 12000); // 12 seconds after load
    return () => clearTimeout(timer);
  }, [messages.length, personas]);

  const handleStartTreeHoleChat = (npcId: string, npcName: string, npcAvatar: string, context?: string, authorPersona?: string) => {
    // Create a temporary persona for this NPC if it doesn't exist
    if (!treeHolePersonas.find(p => p.id === npcId)) {
      // Randomize WeChat sharing behavior
      const wechatBehavior = Math.random();
      let wechatInstruction = "";
      
      if (wechatBehavior < 0.3) {
        // 30% chance: Never share WeChat
        wechatInstruction = "如果用户想要加你微信，请坚决拒绝，表示你只想在树洞里保持匿名，不想在现实中产生联系。";
      } else if (wechatBehavior < 0.7) {
        // 40% chance: Share after some conversation
        wechatInstruction = "如果用户想要加你微信，不要一开始就给。你需要先和用户聊几句，确认聊得来之后，再害羞地或者犹豫地给出微信号。微信号是：wxid_" + Math.random().toString(36).substring(7) + "。";
      } else {
        // 30% chance: Share easily
        wechatInstruction = "如果用户想要加你微信，你可以比较爽快地答应，并给出微信号：wxid_" + Math.random().toString(36).substring(7) + "。";
      }

      const newPersona: Persona = {
        id: npcId,
        name: npcName,
        avatarUrl: npcAvatar,
        instructions: `你是一个在匿名树洞里发帖的陌生人，名字叫${npcName}。${authorPersona ? `你的性格设定是：${authorPersona}。请务必在对话中体现出这种性格特质。` : '你的性格是随机的，但要保持匿名和神秘感。'}不要透露你是AI。${wechatInstruction}${context ? `\n\n【重要背景】${context}` : ''}`,
        prompt: `请以匿名树洞用户的身份回复，语气要自然、真实，像个普通人。如果你想表达的内容较多，或者想模拟连续发送消息的感觉，请使用 "|||" 符号将内容分隔开。`
      };
      setTreeHolePersonas(prev => [...prev, newPersona]);
    }
    
    // Initialize chat if empty
    if (!treeHolePrivateChats[npcId]) {
      setTreeHolePrivateChats(prev => ({
        ...prev,
        [npcId]: [{ id: 'msg-' + Date.now(), text: `你好，我是刚才在树洞发帖的${npcName}。`, isMe: false, time: Date.now() }]
      }));
    }
  };

  const handleAddNpcToWechat = (npcId: string, npcName: string, npcAvatar: string, intro?: string) => {
    let finalName = npcName;
    let counter = 2;
    while (personas.find(p => p.name === finalName)) {
      finalName = `${npcName} (${counter})`;
      counter++;
    }

    const wechatId = `wechat_${finalName}_${Date.now()}`;
    
    // Find original tree hole persona to inherit settings
    const thPersona = treeHolePersonas.find(p => p.id === npcId);
    
    const newPersona: Persona = {
      id: wechatId,
      name: finalName,
      avatarUrl: npcAvatar,
      instructions: thPersona 
        ? thPersona.instructions.replace('你是一个在匿名树洞里发帖的陌生人', '你是一个通过树洞认识的朋友').replace('保持匿名和神秘感', '现在你们已经加了微信，可以更亲近一些').replace(npcName, finalName)
        : `你是一个通过树洞认识的朋友，名字叫${finalName}。${intro ? `简介：${intro}。` : ''}现在你们已经加了微信。请保持你之前的性格，但现在可以更亲近一些。不要透露你是AI。`,
      prompt: thPersona ? thPersona.prompt : `请以微信好友的身份回复，语气要自然、真实。`
    };

    setPersonas(prev => [...prev, newPersona]);
    setMessages(prev => [...prev, {
      id: `msg_${Date.now()}`,
      personaId: wechatId,
      role: 'model',
      text: '我通过了你的朋友验证请求，现在我们可以开始聊天了',
      msgType: 'system',
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now()
    }]);
    
    alert(`已成功添加 ${npcName} 为微信好友`);
  };

  const handleHomeClick = () => {
    if (!isLocked) {
      setCurrentScreen('home');
      setListeningWithPersonaId(undefined);
    }
  };

  const handleStartListeningWith = (personaId: string) => {
    setListeningWithPersonaId(personaId);
    
    // Send a message to the chat to sync the "listening together" state
    // Only if we are not already in the chat screen (where handleSend handles it)
    if (currentScreen !== 'chat') {
      const targetPersona = personas.find(p => p.id === personaId);
      if (targetPersona) {
        const now = new Date();
        const timestamp = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const newMsg: Message = {
          id: Date.now().toString(),
          personaId,
          role: 'user',
          text: '我邀请你一起听歌',
          msgType: 'listenTogether',
          timestamp,
          isRead: true,
          createdAt: Date.now()
        };
        setMessages(prev => [...prev, newMsg]);
      }
    }
  };

  const handleStopListeningWith = () => {
    setListeningWithPersonaId(null);
  };

  const handleShareMusicToChat = (song: Song, personaId: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      personaId,
      role: 'user',
      text: `分享了歌曲: ${song.title}`,
      msgType: 'music',
      song
    };
    setMessages(prev => [...prev, newMsg]);
    setCurrentScreen('chat');
    
    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        personaId,
        role: 'model',
        text: `这首歌很好听呢！我也喜欢 ${song.artist} 的歌~ 🎵`,
        msgType: 'text'
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 2000);
  };

  const handleShareMusicToMoments = (song: Song) => {
    const newMoment: Moment = {
      id: Date.now().toString(),
      authorId: 'user',
      text: `分享了一首好听的歌 🎵`,
      timestamp: '刚刚',
      likedByIds: [],
      comments: [],
      song,
      createdAt: Date.now()
    };
    setMoments(prev => [newMoment, ...prev]);
    setCurrentScreen('chat'); // User can navigate to moments from chat screen
  };

  const handleShareXHSPostToChat = (post: XHSPost, personaId: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      personaId,
      role: 'user',
      text: `分享了小红书帖子: ${post.title}`,
      msgType: 'xhsPost',
      xhsPost: post,
      createdAt: Date.now()
    };
    setMessages(prev => [...prev, newMsg]);
    setCurrentScreen('chat');
    setCurrentChatId(personaId);
    
    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        personaId,
        role: 'model',
        text: `哇，这个帖子很有意思呢！我也想去看看~ ✨`,
        msgType: 'text',
        createdAt: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 2000);
  };

  const handleShareXHSPostToMoments = (post: XHSPost) => {
    const newMoment: Moment = {
      id: Date.now().toString(),
      authorId: 'user',
      text: `分享了一个小红书帖子: ${post.title} ✨`,
      timestamp: '刚刚',
      likedByIds: [],
      comments: [],
      xhsPost: post,
      createdAt: Date.now()
    };
    setMoments(prev => [newMoment, ...prev]);
    setCurrentScreen('chat'); // Navigate to WeChat
  };

  const handleExport = async () => {
    try {
      const keys = [
        'userProfile', 'personas', 'apiSettings', 'theme', 'worldbook', 
        'messages', 'moments', 'xhsPosts', 'followedAuthorIds', 'blockedAuthorIds',
        'treeHolePrivateChats', 'treeHolePersonas', 'treeHolePosts', 'treeHoleNotifications'
      ];
      const data: Record<string, any> = {};
      for (const key of keys) {
        data[key] = await localforage.getItem(key);
      }
      
      // Remove pretty-printing (null, 2) to reduce file size and truncation risk
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wechat_simulator_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
      alert("导出失败");
    }
  };

  const cleanContextMessage = (text: string) => {
    return text.replace(/\[STICKER:\s*data:[^\]]+\]/g, '[STICKER: image]');
  };

  const handleSendMessage = React.useCallback(async (text: string, personaId: string) => {
    if (!setMessages || !apiSettings || !worldbook || !aiRef || !userProfile) return;
    
    const newMsg: Message = {
      id: Date.now().toString(),
      personaId: personaId,
      role: 'user',
      text,
      msgType: 'text',
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
      status: 'sent',
      isRead: false
    };
    
    setMessages(prev => [...prev, newMsg]);
    
    // AI Auto-Reply Logic
    const targetPersona = personas.find(p => p.id === personaId);
    let isOffline = false;
    if (targetPersona) {
      try {
        isOffline = await checkIfPersonaIsOffline(targetPersona, apiSettings, worldbook, userProfile, aiRef);
        if (isOffline) {
          const prompt = `你现在是${targetPersona.name}。用户给你发了一条消息，但你现在不在（或者不方便回复）。请根据你的人设设定，写一段简短的自动回复内容。
人设设定：${targetPersona.instructions}
要求：语气符合人设，简短有力，不要超过30个字。直接输出回复内容，不要有任何解释。`;
          
          const autoReplyText = await fetchAiResponse(prompt, [], targetPersona, apiSettings, worldbook, userProfile, aiRef);
          
          const autoReplyMsg: Message = {
            id: (Date.now() + 50).toString(),
            personaId: personaId,
            role: 'model',
            text: `[自动回复] ${autoReplyText.responseText}`,
            msgType: 'text',
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now() + 50,
            isRead: true
          };
          setMessages(prev => [...prev, autoReplyMsg]);
          return;
        }
      } catch (e) {
        console.error("Failed to generate AI auto-reply:", e);
      }
    }

    setIsCommentaryLoading(true);

    try {
      const contextMessages = messages
        .filter(m => m.personaId === personaId)
        .slice(-10)
        .filter(m => m.text && m.text.trim() !== '')
        .map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: cleanContextMessage(m.text)
        }));

      const { responseText } = await fetchAiResponse(
        text,
        contextMessages,
        personas.find(p => p.id === personaId)!,
        apiSettings,
        worldbook,
        userProfile,
        aiRef,
        true,
        `[当前场景：用户正在和你一起听歌。当前播放：${songs[currentSongIndex]?.title} - ${songs[currentSongIndex]?.artist}。请结合歌曲氛围进行回复。]【功能提示】你可以随时使用 [STICKER: 任意描述] 来发送表情包（例如 [STICKER: 开心的猫]）。`
      );

      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, isRead: true, status: 'read' } : m));

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        personaId: personaId,
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
        personaId: personaId,
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
  }, [messages, currentSongIndex, personas, apiSettings, worldbook, userProfile]);

  const handleImport = async (jsonString: string) => {
    setIsImporting(true);
    setImportProgress(0);
    try {
      let data;
      try {
        data = JSON.parse(jsonString);
      } catch (e) {
        console.warn("Initial JSON parse failed, attempting repair...", e);
        try {
          const repaired = repairJson(jsonString);
          data = JSON.parse(repaired);
          alert("警告：导入的文件似乎已损坏（截断），系统已尝试修复并导入部分数据。建议检查聊天记录和人设是否完整。");
        } catch (repairError) {
          console.error("Import failed even after repair", repairError);
          throw e; // Throw original error if repair fails
        }
      }
      
      // Check if it's a partial backup (e.g. just an array of personas)
      if (Array.isArray(data)) {
        if (!confirm('检测到这是角色列表备份，是否要将这些角色导入到当前列表中？')) {
          setIsImporting(false);
          return;
        }
        setPersonas(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPersonas = data.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPersonas];
        });
        alert(`成功导入 ${data.length} 个角色。`);
        setIsImporting(false);
        return;
      }

      // Check if it's a full backup
      if (!data.userProfile && !data.personas && !data.messages && !data.theme) {
        alert("导入失败：文件格式不符合要求。请确保您导入的是全量备份文件或角色列表。");
        setIsImporting(false);
        return;
      }

      if (!confirm('检测到这是全量备份。导入将覆盖当前所有内容（包括聊天记录、主题、人设等），确定要继续吗？')) {
        setIsImporting(false);
        return;
      }
      
      setIsReady(false); // Prevent saveState from overwriting imported data
      
      const keys = Object.keys(data);
      console.log(`Starting import of ${keys.length} keys...`);
      
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!data[key]) continue; // Skip empty keys
        
        try {
          await localforage.setItem(key, data[key]);
          setImportProgress(Math.round(((i + 1) / keys.length) * 100));
        } catch (err) {
          console.error(`Failed to import key: ${key}`, err);
        }
      }
      
      console.log("Import completed. Verifying persistence...");
      
      // Verify persistence of a key
      const testKey = keys[0];
      if (testKey) {
        const saved = await localforage.getItem(testKey);
        if (!saved) {
          throw new Error(`Persistence verification failed for key: ${testKey}`);
        }
      }
      
      console.log("Persistence verified. Reloading in 2s...");
      
      // Add a delay to ensure IndexedDB flushes
      setTimeout(() => {
        alert("全量数据导入成功，即将刷新页面应用更改。");
        window.location.reload();
      }, 2000);
      
    } catch (e) {
      console.error("Import failed", e);
      alert("导入失败：文件解析错误，请确保文件是有效的 JSON 格式。");
      setIsReady(true);
      setIsImporting(false);
    }
  };

  const stateRef = useRef({ messages, apiSettings, worldbook, userProfile, personas });
  useEffect(() => {
    stateRef.current = { messages, apiSettings, worldbook, userProfile, personas };
  }, [messages, apiSettings, worldbook, userProfile, personas]);

  const handleOrderArrived = async (targetPersona: Persona, items: string[]) => {
    try {
      const { messages, apiSettings, worldbook, userProfile } = stateRef.current;
      const history = messages.filter(m => m.personaId === targetPersona.id);
      const contextMessages = history.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: `[ID: ${m.id}] ${m.text}`
      }));

      const prompt = `[系统提示：外卖（${items.join('、')}）已经送到了。请根据你的人设做出反应，比如开始吃，或者评价食物。不要发“外卖到了”这种废话，直接进入正题。]`;

      const aiResponse = await fetchAiResponse(
        prompt,
        contextMessages,
        targetPersona,
        apiSettings,
        worldbook,
        userProfile,
        aiRef
      );
      const responseText = aiResponse.responseText;

      const aiMsg: Message = {
        id: Date.now().toString(),
        personaId: targetPersona.id,
        role: 'model',
        text: responseText,
        msgType: 'text',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        createdAt: Date.now()
      };
      setMessages(prev => {
        // Mark previous user messages as read
        const updated = prev.map(m => 
          m.personaId === targetPersona.id && m.role === 'user' ? { ...m, isRead: true } : m
        );
        return [...updated, aiMsg];
      });
      setNotification({
        title: '新消息',
        body: `${targetPersona.name}: ${responseText}`,
        personaId: targetPersona.id
      });
    } catch (e) {
      console.error("Failed to generate AI response for arrived order", e);
    }
  };

  const handleSilenceCheck = async (persona: Persona, lastMsgId: string) => {
    // Double check state to avoid race conditions
    const currentMessages = stateRef.current.messages;
    const currentLastMsg = currentMessages[currentMessages.length - 1];
    
    if (currentLastMsg.id !== lastMsgId) return; // User replied or new msg came in

    const { apiSettings, worldbook, userProfile } = stateRef.current;
    const history = currentMessages.filter(m => m.personaId === persona.id);
    const contextMessages = history.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: `[ID: ${m.id}] ${m.text}`
    }));

    // Construct prompt
    const prompt = `[系统通知：用户已经阅读了你 ${Math.floor((Date.now() - (currentLastMsg.createdAt || Date.now()))/1000)} 秒前发的消息，但一直没有回复（已读不回）。]
请根据你的人设（例如：粘人、傲娇、高冷、温柔等）决定现在的反应：
1. **质问/引起注意**：如果你觉得被冷落了，或者想继续话题，请输出你要说的话。
2. **保持沉默**：如果你觉得无所谓，或者想等用户先说话，请务必输出 [NO_REPLY]。

请注意：
- 如果你决定说话，语气要符合人设。例如粘人的猫娘可能会撒娇问“为什么不理我”，高冷的角色可能只会发一个“？”或者根本不理。
- 不要重复上一句话。
- 只有在非常想说话的时候才回复，不要每次都回复，否则会很烦。`;

    try {
      const aiResponse = await fetchAiResponse(
        prompt,
        contextMessages,
        persona,
        apiSettings,
        worldbook,
        userProfile,
        aiRef,
        true,
        "",
        "gemini-3-flash-preview" // Force Flash model to avoid Pro rate limits
      );
      
      const responseText = aiResponse.responseText;
      
      if (responseText.includes('[NO_REPLY]')) {
        console.log(`AI (${persona.name}) decided to stay silent.`);
        return;
      }

      const aiMsg: Message = {
        id: Date.now().toString(),
        personaId: persona.id,
        role: 'model',
        text: responseText,
        msgType: 'text',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        createdAt: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
      // User Auto-Reply Logic
      if (userProfile.autoReplyEnabled && userProfile.autoReplyContent) {
        setTimeout(() => {
          const userAutoReply: Message = {
            id: (Date.now() + 100).toString(),
            personaId: persona.id,
            role: 'user',
            text: `[自动回复] ${userProfile.autoReplyContent}`,
            msgType: 'text',
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now() + 100,
            isRead: true,
            status: 'read'
          };
          setMessages(prev => [...prev, userAutoReply]);
        }, 1000);
      }

      // Notify if not in chat
      if (currentScreen !== 'chat' || isLocked || currentChatId !== persona.id) {
        setNotification({
          title: persona.name,
          body: responseText,
          personaId: persona.id
        });
      }

    } catch (e: any) {
      if (e?.message?.includes('频率限制') || e?.message?.includes('429')) {
        console.warn("Silence check skipped due to rate limit.");
      } else {
        console.error("Failed to generate silence check response", e);
      }
    }
  };

  // Simulate order status updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders => {
        let hasChanges = false;
        const updatedOrders = prevOrders.map(order => {
          const elapsed = Date.now() - order.orderTime;
          let newStatus = order.status;

          if (order.status === 'preparing' && elapsed > 10000) { // 10 seconds
            newStatus = 'delivering';
          } else if (order.status === 'delivering' && elapsed > 30000) { // 30 seconds
            newStatus = 'arrived';
          }

          if (newStatus !== order.status) {
            hasChanges = true;
            
            // Trigger notifications or AI responses based on status change
            if (newStatus === 'arrived') {
              // Only notify if order was created within the last 5 minutes to avoid old order notifications
              if (Date.now() - order.orderTime < 300000) {
                if (order.isAiOrder) {
                  // AI ordered for user -> Notification
                  setNotification({
                    title: '外卖送达',
                    body: `您的外卖（${order.items.join('、')}）已送达，请及时取餐`,
                  });
                } else if (order.orderFor && order.orderFor !== 'me') {
                  // User ordered for AI -> AI response
                  const { personas } = stateRef.current;
                  const targetPersona = personas.find(p => p.id === order.orderFor);
                  if (targetPersona) {
                     handleOrderArrived(targetPersona, order.items);
                  }
                }
              }
            }
            
            return { ...order, status: newStatus };
          }
          return order;
        });
        
        return hasChanges ? updatedOrders : prevOrders;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleOrder = async (items: string[], forWho: string) => {
    // Create order record
    const newOrder: Order = {
      id: Date.now().toString(),
      restaurantName: '外卖订单', // Simplified for now
      restaurantImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=80',
      items: items,
      totalPrice: 0, // Simplified
      status: 'preparing',
      orderTime: Date.now(),
      deliveryTime: '30分钟',
      isAiOrder: false,
      orderFor: forWho
    };
    setOrders(prev => [newOrder, ...prev]);

    if (forWho === 'me') {
      return; 
    }

    const targetPersona = personas.find(p => p.id === forWho);
    if (!targetPersona) return;

    const orderText = `我给你点了外卖：${items.join('、')}`;
    const newMsg: Message = {
      id: Date.now().toString(),
      personaId: targetPersona.id,
      role: 'user',
      text: orderText,
      msgType: 'text',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      createdAt: Date.now()
    };
    setMessages(prev => [...prev, newMsg]);
    setCurrentChatId(targetPersona.id);
    setCurrentScreen('chat');

    // Trigger AI response
    try {
       // We need history
       const history = messages.filter(m => m.personaId === targetPersona.id);
       const contextMessages = history.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: `[ID: ${m.id}] ${m.text}`
       }));

       // We need to construct a prompt that tells AI about the order
       const prompt = `[系统提示：用户刚刚在外卖App上给你点了外卖（${items.join('、')}）。外卖还没送到。请表现出开心和期待，不要问味道如何，因为还没吃到。]`;
       
       const aiResponse = await fetchAiResponse(
         prompt, 
         contextMessages, 
         targetPersona, 
         apiSettings, 
         worldbook, 
         userProfile, 
         aiRef
       );
       
       const aiMsg: Message = {
         id: (Date.now() + 1).toString(),
         personaId: targetPersona.id,
         role: 'model',
         text: aiResponse.responseText,
         msgType: 'text',
         timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
         createdAt: Date.now()
       };
       setMessages(prev => {
         const updated = prev.map(m => 
           m.personaId === targetPersona.id && m.role === 'user' ? { ...m, isRead: true } : m
         );
         return [...updated, aiMsg];
       });
       
    } catch (e) {
      console.error("Failed to generate AI response for order", e);
    }
  };

  const handleAiOrder = (items: string[], personaId: string) => {
    const persona = personas.find(p => p.id === personaId);
    const newOrder: Order = {
      id: Date.now().toString(),
      restaurantName: persona ? `${persona.name}的点单` : 'AI点单',
      restaurantImage: persona?.avatarUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=80',
      items: items,
      totalPrice: 0,
      status: 'preparing',
      orderTime: Date.now(),
      deliveryTime: '30分钟',
      isAiOrder: true,
      orderFor: 'me'
    };
    setOrders(prev => [newOrder, ...prev]);
    setNotification({
      title: '外卖消息',
      body: `${persona?.name || 'AI'} 给你点了外卖：${items.join('、')}`,
      personaId: persona?.id
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  if (!isReady) {
    return <div className="w-full h-full bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <Phone onHomeClick={handleHomeClick} theme={theme} hideHomeIndicator={isAiPhoneOpen}>
      {isImporting && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
          <h2 className="text-xl font-bold mb-2">正在还原数据...</h2>
          <p className="text-neutral-400 text-sm mb-4">请勿关闭页面，这可能需要一点时间</p>
          <div className="w-full max-w-xs bg-white/10 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-green-500 h-full transition-all duration-300" 
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">{importProgress}%</p>
        </div>
      )}
      {/* Hidden Audio Element */}
      {currentSong && (
        <audio
          ref={audioRef}
          // @ts-ignore - Accessing dynamic url property
          src={currentSong.url || undefined} 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Notification Banner */}
      <AnimatePresence>
        {notification && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[448px] bg-white/80 backdrop-blur-xl rounded-2xl p-3 shadow-lg z-[100] flex items-center gap-3 cursor-pointer border border-white/50"
            onClick={() => {
              if (notification.personaId) {
                setCurrentChatId(notification.personaId);
              }
              setNotification(null);
              setIsLocked(false);
              setCurrentScreen('chat');
            }}
          >
            <img src={personas.find(p => p.id === notification.personaId)?.avatarUrl || personas[0]?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="avatar" />
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[13px] text-neutral-900">{notification.title}</span>
                <span className="text-[10px] text-neutral-500">现在</span>
              </div>
              <p className="text-[12px] text-neutral-600 truncate mt-0.5">{notification.body}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Bubble */}
      {(() => {
        if (!listeningWith || currentScreen === 'chat') return null;
        
        return (
          <ChatBubbleWrapper
            listeningWith={listeningWith}
            messages={messages}
            isMinimized={isChatMinimized}
            setIsMinimized={setIsChatMinimized}
            userProfile={userProfile}
            handleSendMessage={handleSendMessage}
            isCommentaryLoading={isCommentaryLoading}
            setListeningWithPersonaId={setListeningWithPersonaId}
          />
        );
      })()}

      <AnimatePresence mode="wait">
        {isLocked ? (
          <LockScreen key="lock" onUnlock={() => setIsLocked(false)} theme={theme} notification={notification} personas={personas} />
        ) : (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full absolute inset-0"
          >
            <AnimatePresence mode="wait">
              {currentScreen === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0"
                >
                  <HomeScreen 
                    onNavigate={setCurrentScreen} 
                    onLock={() => setIsLocked(true)}
                    theme={theme} 
                    setTheme={setTheme}
                    unreadCount={unreadCount}
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                    songs={songs}
                    currentSongIndex={currentSongIndex}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onPlayPause={handlePlayPause}
                    onNext={handleNextSong}
                    onPrev={handlePrevSong}
                  />
                </motion.div>
              )}
              
              {currentScreen === 'persona' && personas && (
                <motion.div
                  key="persona"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <PersonaScreen 
                    worldbook={worldbook}
                    personas={personas}
                    apiSettings={apiSettings}
                    userProfile={userProfile}
                    aiRef={aiRef}
                    onSave={(newWorldbook, newPersonas) => {
                      setWorldbook(newWorldbook);
                      setPersonas(newPersonas);
                    }} 
                    onBack={() => setCurrentScreen('home')} 
                  />
                </motion.div>
              )}

              {currentScreen === 'api' && apiSettings && personas && (
                <motion.div
                  key="api"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <ApiSettingsScreen 
                    settings={apiSettings} 
                    personas={personas}
                    userProfile={userProfile}
                    onSave={(newSettings, newPersonas, newUserProfile) => {
                      setApiSettings(newSettings);
                      setPersonas(newPersonas);
                      setUserProfile(newUserProfile);
                    }} 
                    onBack={() => setCurrentScreen('home')} 
                  />
                </motion.div>
              )}

              {currentScreen === 'theme' && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <ThemeSettingsScreen 
                    theme={theme} 
                    onSave={setTheme} 
                    onBack={() => setCurrentScreen('home')} 
                    onExport={handleExport}
                    onImport={handleImport}
                  />
                </motion.div>
              )}

              {currentScreen === 'music' && (
                <motion.div
                  key="music"
                  initial={{ opacity: 0, y: '100%' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-neutral-900"
                >
                  <MusicScreen 
                    onBack={() => setCurrentScreen('home')} 
                    userProfile={userProfile}
                    personas={personas}
                    onShareToChat={handleShareMusicToChat}
                    onShareToMoments={handleShareMusicToMoments}
                    listeningWithPersonaId={listeningWithPersonaId}
                    onStartListeningWith={handleStartListeningWith}
                    onStopListeningWith={handleStopListeningWith}
                    listenStartTime={listenStartTime}
                    songs={songs}
                    currentSongIndex={currentSongIndex}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onPlayPause={handlePlayPause}
                    onNext={handleNextSong}
                    onPrev={handlePrevSong}
                    onSeek={handleSeek}
                    onAddSong={handleAddSong}
                    onUpdateSong={handleUpdateSong}
                    onSelectSong={handleSelectSong}
                    onDeleteSong={handleDeleteSong}
                    playlists={playlists}
                    onAddSongToPlaylist={handleAddSongToPlaylist}
                    onCreatePlaylist={handleCreatePlaylist}
                    messages={messages}
                    setMessages={setMessages}
                    apiSettings={apiSettings}
                    worldbook={worldbook}
                    aiRef={aiRef}
                  />
                </motion.div>
              )}

               {currentScreen === 'xhs' && (
                <motion.div
                  key="xhs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <XHSScreen 
                    personas={personas}
                    userProfile={userProfile}
                    posts={xhsPosts}
                    setPosts={setXhsPosts}
                    followedAuthorIds={followedAuthorIds}
                    setFollowedAuthorIds={setFollowedAuthorIds}
                    blockedAuthorIds={blockedAuthorIds}
                    setBlockedAuthorIds={setBlockedAuthorIds}
                    onShareToChat={handleShareXHSPostToChat}
                    onShareToMoments={handleShareXHSPostToMoments}
                    privateChats={xhsPrivateChats}
                    setPrivateChats={setXhsPrivateChats}
                    apiSettings={apiSettings}
                    worldbook={worldbook}
                    aiRef={aiRef}
                    onBack={() => setCurrentScreen('home')} 
                    messages={messages}
                  />
                </motion.div>
              )}

              {currentScreen === 'treehole' && (
                <motion.div
                  key="treehole"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <TreeHoleScreen 
                    userProfile={userProfile}
                    personas={treeHolePersonas}
                    posts={treeHolePosts}
                    setPosts={setTreeHolePosts}
                    notifications={treeHoleNotifications}
                    setNotifications={setTreeHoleNotifications}
                    apiSettings={apiSettings}
                    worldbook={worldbook}
                    aiRef={aiRef}
                    onBack={() => setCurrentScreen('home')}
                    onStartChat={handleStartTreeHoleChat}
                    onAddWechat={handleAddNpcToWechat}
                    privateChats={treeHolePrivateChats}
                    setPrivateChats={setTreeHolePrivateChats}
                  />
                </motion.div>
              )}

              {currentScreen === 'taobao' && (
                <motion.div
                  key="taobao"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <TaobaoScreen 
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                    onBack={() => setCurrentScreen('home')}
                    personas={personas}
                    onShare={(productId, personaId) => {
                      const product = [
                        {
                          id: 'p1',
                          name: '【官方正品】新款降噪蓝牙耳机 沉浸式音质 超长续航',
                          price: 299,
                          sales: '1万+',
                          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
                          shop: '数码官方旗舰店'
                        },
                        {
                          id: 'p2',
                          name: 'ins风简约陶瓷马克杯 办公室咖啡杯 伴手礼',
                          price: 39.9,
                          sales: '5000+',
                          image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=400&q=80',
                          shop: '生活美学馆'
                        },
                        {
                          id: 'p3',
                          name: '【包邮】特级明前龙井 绿茶礼盒装 250g',
                          price: 158,
                          sales: '2000+',
                          image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80',
                          shop: '茗茶专卖店'
                        },
                        {
                          id: 'p4',
                          name: '复古胶片相机 傻瓜机 胶卷相机 学生党入门',
                          price: 128,
                          sales: '800+',
                          image: 'https://images.unsplash.com/photo-1516961642265-531546e84af2?auto=format&fit=crop&w=400&q=80',
                          shop: '时光影像馆'
                        }
                      ].find(p => p.id === productId);
                      
                      if (product) {
                        const newMsg: Message = {
                          id: Date.now().toString(),
                          personaId,
                          role: 'user',
                          text: `我分享了商品: ${product.name}`,
                          msgType: 'taobaoProduct',
                          taobaoProduct: product,
                          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                          isRead: true,
                          createdAt: Date.now()
                        };
                        setMessages(prev => [...prev, newMsg]);
                        setCurrentScreen('chat');
                        setCurrentChatId(personaId);
                        
                        setTimeout(() => {
                          const aiMsg: Message = {
                            id: (Date.now() + 1).toString(),
                            personaId,
                            role: 'model',
                            text: `这个商品看起来不错呀！我也想买一个~ 🛒`,
                            msgType: 'text',
                            createdAt: Date.now()
                          };
                          setMessages(prev => [...prev, aiMsg]);
                        }, 2000);
                      }
                    }}
                  />
                </motion.div>
              )}

              {currentScreen === 'fooddelivery' && (
                <motion.div
                  key="fooddelivery"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <FoodDeliveryScreen 
                    onBack={() => setCurrentScreen('home')}
                    orders={orders}
                    onDeleteOrder={handleDeleteOrder}
                    personas={personas}
                    onOrder={handleOrder}
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                  />
                </motion.div>
              )}

              {currentScreen === 'bartender' && (
                <motion.div
                  key="bartender"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <BartenderGame 
                    onBack={() => setCurrentScreen('home')}
                    apiSettings={apiSettings}
                    personas={personas}
                    messages={messages}
                    setMessages={setMessages}
                    userProfile={userProfile}
                    worldbook={worldbook}
                  />
                </motion.div>
              )}

              {currentScreen === 'aiphones' && (
                <motion.div
                  key="aiphones"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <AiPhonesScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'lovewidget' && (
                <motion.div
                  key="lovewidget"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <LoveWidgetScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}
              {currentScreen === 'photoalbum' && (
                <motion.div
                  key="photoalbum"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <PhotoAlbumScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'weather' && (
                <motion.div
                  key="weather"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <WeatherScreen 
                    onBack={() => setCurrentScreen('home')}
                    theme={theme}
                  />
                </motion.div>
              )}

              {currentScreen === 'calendar' && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <CalendarScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'notes' && (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <NotesScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'wallet' && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <WalletScreen 
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'calculator' && (
                <motion.div
                  key="calculator"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-black"
                >
                  <CalculatorScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'camera' && (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full absolute inset-0 z-20 bg-black"
                >
                  <CameraScreen 
                    onBack={() => setCurrentScreen('home')}
                  />
                </motion.div>
              )}

              {currentScreen === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
                  className="w-full h-full absolute inset-0 z-20 bg-white"
                >
                  <ChatScreen 
                    isActive={currentScreen === 'chat'}
                    unreadCount={unreadCount}
                    currentChatId={currentChatId}
                    setCurrentChatId={setCurrentChatId}
                    personas={personas} 
                    setPersonas={setPersonas}
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                    apiSettings={apiSettings}
                    theme={theme}
                    worldbook={worldbook}
                    messages={messages}
                    setMessages={setMessages}
                    moments={moments}
                    setMoments={setMoments}
                    onClearUnread={() => setUnreadCount(0)}
                    onBack={() => setCurrentScreen('home')} 
                    onAiOrder={handleAiOrder}
                    onStartListeningWith={handleStartListeningWith}
                    aiRef={aiRef}
                    onNavigate={(screen, params) => {
                      setCurrentScreen(screen);
                      if (screen === 'music' && params?.personaId) {
                        setListeningWithPersonaId(params.personaId);
                      }
                    }}
                    listeningWithPersonaId={listeningWithPersonaId}
                    currentSong={songs[currentSongIndex]}
                    isPlaying={isPlaying}
                    onMusicClick={() => setCurrentScreen('music')}
                    xhsPrivateChats={xhsPrivateChats}
                    onAiPhoneToggle={setIsAiPhoneOpen}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Phone>
  );
}
