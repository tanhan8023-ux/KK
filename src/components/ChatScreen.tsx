import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Loader2, Plus, ArrowLeftRight, MessageCircle, Compass, Bookmark, Image as ImageIcon, MoreHorizontal, MessageSquare, Heart, Camera, UserPlus, Trash2, Ban, Users, Play, RefreshCw, Wallet, X, CreditCard, Smile, Music, Film, Moon, Shield, RotateCcw, Settings, Sliders, Phone, Mic, MicOff, Video, VideoOff, User, Smartphone } from 'lucide-react';
import { Message, Persona, UserProfile, ApiSettings, ThemeSettings, Moment, Comment, WorldbookSettings, Transaction, Screen } from '../types';
import { GoogleGenAI } from '@google/genai';
import { AnimatePresence, motion } from 'motion/react';
import { fetchAiResponse, generateMoment, checkIfPersonaIsOffline } from '../services/aiService';

import { WalletScreen } from './WalletScreen';
import { ChatInput } from './ChatInput';
import { ChatListView } from './ChatListView';
import { AiPhoneModal } from './AiPhoneModal';

interface Props {
  personas: Persona[];
  setPersonas: React.Dispatch<React.SetStateAction<Persona[]>>;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  apiSettings: ApiSettings;
  theme: ThemeSettings;
  worldbook: WorldbookSettings;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  moments: Moment[];
  setMoments: React.Dispatch<React.SetStateAction<Moment[]>>;
  onClearUnread: () => void;
  onBack: () => void;
  onNavigate: (screen: Screen, params?: any) => void;
  isActive: boolean;
  unreadCount: number;
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  onAiOrder: (items: string[], personaId: string) => void;
  onStartListeningWith?: (id: string) => void;
  listeningWithPersonaId?: string | null;
  currentSong?: any;
  isPlaying?: boolean;
  onMusicClick?: () => void;
  xhsPrivateChats?: Record<string, { text: string, isMe: boolean, time: number }[]>;
  onAiPhoneToggle?: (isOpen: boolean) => void;
}

import localforage from 'localforage';

const renderTextWithStickers = (text: string) => {
  if (!text) return null;
  // Strip hidden tags
  const cleanText = text.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim();
  const parts = cleanText.split(/(\[STICKER:\s*[^\]]+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[STICKER:\s*([^\]]+)\]/);
    if (match) {
      let src = match[1].trim();
      if (!src.startsWith('http') && !src.startsWith('data:')) {
        src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(src)}`;
      }
      return <img key={i} src={src} className="w-16 h-16 inline-block object-contain my-1" alt="Sticker" referrerPolicy="no-referrer" />;
    }
    return <span key={i} className="break-words break-all whitespace-pre-wrap">{part}</span>;
  });
};

export function ChatScreen({ 
  personas, setPersonas, userProfile, setUserProfile, apiSettings, theme, worldbook, 
  messages, setMessages, moments, setMoments, onClearUnread, onBack, onNavigate, 
  isActive, unreadCount, currentChatId, setCurrentChatId, onAiOrder,
  onStartListeningWith,
  listeningWithPersonaId, currentSong, isPlaying, onMusicClick,
  xhsPrivateChats,
  onAiPhoneToggle
}: Props) {
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'moments' | 'favorites' | 'theater'>('chat');
  const [showWallet, setShowWallet] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');

  const [isTyping, setIsTyping] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedTransferMsg, setSelectedTransferMsg] = useState<Message | null>(null);
  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [isStickerManagementMode, setIsStickerManagementMode] = useState(false);
  const [showAddStickerModal, setShowAddStickerModal] = useState(false);
  const [stickerToEdit, setStickerToEdit] = useState<{id?: string, name: string, url: string} | null>(null);
  const [stickerToDelete, setStickerToDelete] = useState<{id?: string, name: string, url: string} | null>(null);
  const [newStickerName, setNewStickerName] = useState('');
  const [newStickerUrl, setNewStickerUrl] = useState('');
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showAiPhone, setShowAiPhone] = useState(false);

  useEffect(() => {
    onAiPhoneToggle?.(showAiPhone);
  }, [showAiPhone, onAiPhoneToggle]);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [showTheaterSettings, setShowTheaterSettings] = useState(false);
  const [theaterSettings, setTheaterSettings] = useState({
    bgOpacity: 20,
    bgBlur: 0,
    dialogueSize: 18,
    descriptionSize: 15,
    showBorder: true,
    hideDelimiters: true,
    fontSerif: true,
    userRoleName: '',
    aiRoleName: ''
  });
  
  // Transfer State
  const [showTransferModal, setShowTransferModal] = useState(false);
  
  // Unread Reaction State
  const [unreadPesterCount, setUnreadPesterCount] = useState(0);
  const unreadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor for "Read but no reply"
  useEffect(() => {
    // Clear existing timer on any message change or typing
    if (unreadTimerRef.current) {
      clearTimeout(unreadTimerRef.current);
      unreadTimerRef.current = null;
    }

    if (!currentChatId || !messages.length) return;

    const lastMsg = messages[messages.length - 1];
    const currentPersona = personas.find(p => p.id === currentChatId);

    if (!currentPersona) return;

    // If user replied, reset pester count
    if (lastMsg.role === 'user') {
      setUnreadPesterCount(0);
      return;
    }

    // If last message is from AI and is read (and we are not currently typing/generating)
    if (lastMsg.role === 'model' && (lastMsg.isRead || lastMsg.status === 'read') && !isTyping && !isLoading) {
      
      // Determine delay based on pester count
      // First check: 5m 15s (simulate "waiting for reply")
      // Subsequent: depends on previous behavior, but default to 5m 10s for demo purposes if not specified
      let delay = 315000; 
      
      if (unreadPesterCount > 0) {
        // If we are in "pester mode", default to shorter intervals unless AI said otherwise
        delay = 310000;
      }

      // Check for hidden instruction in the last message to adjust delay
      if (lastMsg.text.includes('||NEXT:IMMEDIATE||')) delay = 3000; // Fast bombardment
      if (lastMsg.text.includes('||NEXT:SHORT||')) delay = 10000;
      if (lastMsg.text.includes('||NEXT:LONG||')) delay = 60000;
      if (lastMsg.text.includes('||NEXT:STOP||')) return; // Stop pestering

      unreadTimerRef.current = setTimeout(() => {
        handleUnreadReaction(currentPersona, lastMsg.id);
      }, delay);
    }

    return () => {
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current);
      }
    };
  }, [messages, currentChatId, isTyping, isLoading, unreadPesterCount]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model' && !lastMsg.isRead) {
        setMessages(prev => prev.map(m => m.id === lastMsg.id ? { ...m, isRead: true, status: 'read' } : m));
      }
    }
  }, [currentChatId, messages]);

  const handleUnreadReaction = async (persona: Persona, lastMsgId: string) => {
    // Double check state hasn't changed
    const currentLastMsg = messages[messages.length - 1];
    if (currentLastMsg.id !== lastMsgId || currentLastMsg.role === 'user' || persona.isOffline) return;

    setIsTyping(true);
    
    try {
      // Construct prompt for "Unread Reaction"
      const timeSinceRead = unreadPesterCount === 0 ? "3分钟" : `${3 + unreadPesterCount * 3}分钟`;
      
      const pesterPrompt = `
[系统指令：已读不回反应模式]
用户已读了你的上一条消息，但已经过了 ${timeSinceRead} 没有回复。
你已经发送了 ${unreadPesterCount} 条追问消息试图引起注意。

请根据你的人设 (${persona.name}) 决定你的反应策略：
1. **粘人/轰炸 (Bombard/Clingy)**：如果你是焦虑/粘人型，发送一条简短、情绪化的消息。（例如：“理理我嘛”、“人呢？”、“别不理我呀！”）
2. **随性/定期 (Periodic/Casual)**：如果你是随性型，可以换个话题或分享个表情包描述。
3. **高冷/傲娇 (Proud/Cold)**：如果你是高冷/傲娇型，可能会停止发送消息（放弃），或者发最后一条“哼，不回算了”。
4. **放弃 (Give Up)**：如果你觉得已经打扰够了，或者根据人设觉得没必要再发，停止发送。

**输出格式要求**：
直接输出你的消息内容。
在消息的**最后**，必须附带以下隐藏标签之一，以决定下一步的反应：
- \`||NEXT:IMMEDIATE||\`：5秒后再次检查（用于快速轰炸）。
- \`||NEXT:SHORT||\`：10秒后再次检查。
- \`||NEXT:LONG||\`：60秒后再次检查（用于偶尔发）。
- \`||NEXT:STOP||\`：停止检查/不再骚扰。

如果你决定**完全不发送任何消息**（保持沉默），请仅输出：\`[NO_REPLY]\`
`;

      const aiRef = { current: new GoogleGenAI({ apiKey: apiSettings.apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY as string }) };
      
      // We use the existing context but inject our system instruction
      const eventPrompt = `[系统事件：用户已读你的消息但 ${timeSinceRead} 未回复。当前追问次数：${unreadPesterCount}。请决定反应。]`;
      
      const response = await fetchAiResponse(
        eventPrompt,
        messages,
        persona,
        apiSettings,
        worldbook,
        userProfile,
        aiRef as any,
        false, // disable quote
        pesterPrompt, // additional instructions
        "gemini-3-flash-preview", // Force Flash model
        undefined,
        persona.isOffline
      );

      let text = response.responseText;

      if (text.includes('[NO_REPLY]')) {
        setIsTyping(false);
        setUnreadPesterCount(prev => prev + 1); 
        return;
      }
      
      const newMessage: Message = {
        id: Date.now().toString(),
        personaId: persona.id,
        role: 'model',
        text: text,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        isRead: true, // Auto-read since user is looking at it?
        createdAt: Date.now()
      };

      setMessages(prev => [...prev, newMessage]);
      setUnreadPesterCount(prev => prev + 1);

    } catch (error: any) {
      if (error?.message?.includes('频率限制') || error?.message?.includes('429')) {
        console.warn("Unread reaction skipped due to rate limit.");
      } else {
        console.error("Unread reaction failed", error);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const [transferAmount, setTransferAmount] = useState('520');
  const [transferNote, setTransferNote] = useState('');

  // Relative Card State
  const [showRelativeCardModal, setShowRelativeCardModal] = useState(false);
  const [relativeCardLimit, setRelativeCardLimit] = useState('1000');
  
  // Moments State
  const [commentInput, setCommentInput] = useState('');
  const [commentingMomentId, setCommentingMomentId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [aiReplyingMomentId, setAiReplyingMomentId] = useState<string | null>(null);
  const [isPostingMoment, setIsPostingMoment] = useState(false);
  const [newMomentText, setNewMomentText] = useState('');
  const [isAiProcessingMoment, setIsAiProcessingMoment] = useState(false);
  const [isAiPostingMoment, setIsAiPostingMoment] = useState(false);
  const [showPersonaMomentsId, setShowPersonaMomentsId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  // Add Friend State
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showTheater, setShowTheater] = useState(false);
  const [activeTheaterScript, setActiveTheaterScript] = useState<{title: string, desc: string} | null>(null);
  const [showCreateScript, setShowCreateScript] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState('');
  const [newScriptDesc, setNewScriptDesc] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendPrompt, setNewFriendPrompt] = useState('');
  const [showPersonaSettings, setShowPersonaSettings] = useState(false);
  const [tempUserPersona, setTempUserPersona] = useState('');
  // Call State
  const [callState, setCallState] = useState<{
    isActive: boolean;
    type: 'voice' | 'video';
    status: 'dialing' | 'connected' | 'ended';
    startTime?: number;
    duration: number;
    isMuted: boolean;
    isCameraOff: boolean;
  }>({
    isActive: false,
    type: 'voice',
    status: 'dialing',
    duration: 0,
    isMuted: false,
    isCameraOff: false
  });

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequests = useRef(0);
  const [showAutoReplyModal, setShowAutoReplyModal] = useState(false);
  const [showAvatarFrameModal, setShowAvatarFrameModal] = useState(false);
  const [tempAutoReplyContent, setTempAutoReplyContent] = useState(userProfile.autoReplyContent || '');
  const [tempAutoReplyEnabled, setTempAutoReplyEnabled] = useState(userProfile.autoReplyEnabled || false);

  const handleAiDefineUserAutoReply = async () => {
    try {
      const prompt = `你现在是${userProfile.name}。请根据你的人设设定，写一段简短的自动回复内容（用于你不在时回复好友）。
人设设定：${userProfile.persona || '一个普通人'}
要求：语气自然，简短有力，不要超过30个字。直接输出回复内容，不要有任何解释。`;
      
      alert('正在让 AI 生成自动回复...');
      const dummyPersona: Persona = {
        id: 'user',
        name: userProfile.name,
        instructions: userProfile.persona || '一个普通人',
      };
      const response = await fetchAiResponse(
        prompt, 
        [], 
        dummyPersona,
        apiSettings,
        worldbook,
        userProfile,
        aiRef,
        false,
        "",
        "gemini-3-flash-preview",
        undefined,
        false // user is always online
      );
      
      if (response && response.responseText) {
        setTempAutoReplyContent(response.responseText.trim());
      }
    } catch (e) {
      console.error("Failed to generate AI auto-reply:", e);
      alert('生成失败，请手动填写。');
    }
  };
  const [tempAvatarFrame, setTempAvatarFrame] = useState('');
  const [tempAvatarFrameScale, setTempAvatarFrameScale] = useState(1);
  const [tempAvatarFrameX, setTempAvatarFrameX] = useState(0);
  const [tempAvatarFrameY, setTempAvatarFrameY] = useState(0);
  const [tempAvatarPendant, setTempAvatarPendant] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const debouncedAiResponseTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const lastAutonomousPostTime = useRef<number>(0);

  // Autonomous posting logic
  useEffect(() => {
    if (!isActive) return;

    const checkAndPost = async () => {
      const now = Date.now();
      // Check every 10-20 minutes (randomized)
      if (now - lastAutonomousPostTime.current < (10 + Math.random() * 10) * 60 * 1000) return;

      // 20% chance to post if time is up
      if (Math.random() > 0.2) return;

      const activePersonas = personas.filter(p => !p.isBlocked);
      if (activePersonas.length === 0) return;

      const randomPersona = activePersonas[Math.floor(Math.random() * activePersonas.length)];
      lastAutonomousPostTime.current = now;

      try {
        const { content, imageUrl } = await generateMoment(randomPersona, apiSettings, worldbook);
        if (content || imageUrl) {
          const newMoment: Moment = {
            id: Date.now().toString(),
            authorId: randomPersona.id,
            text: content,
            imageUrl: imageUrl,
            timestamp: '刚刚',
            createdAt: Date.now(),
            likedByIds: [],
            comments: []
          };
          setMoments(prev => [newMoment, ...prev]);
        }
      } catch (e) {
        console.error("Autonomous moment generation failed:", e);
      }
    };

    const interval = setInterval(checkAndPost, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [isActive, personas, apiSettings, worldbook, setMoments]);

  const handleVoiceChat = () => {
    setIsVoiceChatActive(!isVoiceChatActive);
    // Here you would integrate the Gemini Live API
    if (!isVoiceChatActive) {
      console.log("Starting voice chat...");
    } else {
      console.log("Stopping voice chat...");
    }
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    setCallState({
      isActive: true,
      type,
      status: 'dialing',
      duration: 0,
      isMuted: false,
      isCameraOff: false
    });
    setShowPlusMenu(false);

    // Simulate AI answering after a few seconds
    setTimeout(() => {
      setCallState(prev => ({ ...prev, status: 'connected', startTime: Date.now() }));
      
      // Start timer
      callTimerRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 3000);
  };

  const handleEndCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    const durationText = formatCallDuration(callState.duration);
    const callType = callState.type === 'voice' ? '语音通话' : '视频通话';
    
    // Add system message
    const systemMsg: Message = {
      id: Date.now().toString(),
      personaId: currentChatId!,
      role: 'model', // Or 'system' if supported, but model is fine for display usually
      text: `[${callType}结束，时长 ${durationText}]`,
      msgType: 'text',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      isRead: true,
      createdAt: Date.now()
    };
    setMessages(prev => [...prev, systemMsg]);

    setCallState(prev => ({ ...prev, isActive: false, status: 'ended' }));
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleCamera = () => {
    setCallState(prev => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  };

  const defaultAiAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
  const defaultUserAvatar = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80';

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (debouncedAiResponseTimeout.current) {
        clearTimeout(debouncedAiResponseTimeout.current);
      }
    };
  }, []);

  const prevMessagesLength = useRef(messages.length);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > prevMessagesLength.current) {
      const lastMsg = messages[messages.length - 1];
      // Play sound if it's a new message from the model AND it's not a "typing" indicator or similar (though here we only have final messages)
      // Also check if the chat screen is active or if we want to play it regardless
      // Disable notification sound if music is playing to prevent interruption
      if (lastMsg.role === 'model' && theme.notificationSound && !isPlaying) {
        const audio = new Audio(theme.notificationSound);
        audio.play().catch(e => console.error("Failed to play notification sound", e));
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, theme.notificationSound]);

  const formatRelativeTime = (timestampMs: number | undefined) => {
    if (!timestampMs) return '';
    const diff = currentTime - timestampMs;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  const [visibleMessagesCount, setVisibleMessagesCount] = useState(200);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    setVisibleMessagesCount(200);
    isNearBottomRef.current = true;
  }, [currentChatId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && visibleMessagesCount < currentMessages.length) {
      setVisibleMessagesCount(prev => Math.min(prev + 50, currentMessages.length));
    }
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const currentPersona = personas.find(p => p.id === currentChatId);

  const theaterMessages = React.useMemo(() => {
    if (!activeTheaterScript || !currentPersona) return [];
    return messages.filter(m => m.personaId === currentPersona.id && m.theaterId === activeTheaterScript.title);
  }, [messages, currentChatId, activeTheaterScript, currentPersona]);

  const currentMessages = React.useMemo(() => {
    if (activeTheaterScript) {
      return theaterMessages;
    }
    return messages.filter(m => m.personaId === currentChatId && !m.theaterId && !m.hidden);
  }, [messages, currentChatId, activeTheaterScript, theaterMessages]);

  // Inject custom CSS into a style tag for better compatibility and power
  useEffect(() => {
    const styleId = 'custom-bubble-styles';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    const userCss = theme.chatBubbleUserCss || '';
    const aiCss = theme.chatBubbleAiCss || '';
    const innerVoiceCss = theme.innerVoiceCss || '';

    // Helper to wrap CSS if it doesn't look like a full block
    const wrapCss = (css: string, selector: string) => {
      if (!css.trim()) return '';
      // Remove comments to check the actual start of the CSS
      let cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      
      // If the user pasted a full CSS rule starting with a class or ID, e.g., ".bubble { ... }"
      // We replace that specific class/ID with our selector to ensure it applies to the bubble.
      const match = cleanCss.match(/^([.#][a-zA-Z0-9_-]+)/);
      if (match) {
        const selectorName = match[1];
        // Replace all occurrences of this selector name with our selector
        return cleanCss.replaceAll(selectorName, selector);
      }
      
      // If it doesn't start with a class/ID, assume it's just properties and wrap them
      return `${selector} { ${cleanCss} }`;
    };

    styleTag.innerHTML = `
      ${wrapCss(userCss, '.custom-bubble-user.custom-bubble-user')}
      ${wrapCss(aiCss, '.custom-bubble-ai.custom-bubble-ai')}
      ${wrapCss(innerVoiceCss, '.custom-inner-voice.custom-inner-voice')}
    `;
  }, [theme.chatBubbleUserCss, theme.chatBubbleAiCss, theme.innerVoiceCss]);

  useEffect(() => {
    if (isActive && activeTab === 'chat' && currentChatId) {
      onClearUnread();
      if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [messages, activeTab, currentChatId, onClearUnread, isActive]);

  useEffect(() => {
    if (!currentChatId || pendingRequests.current > 0) return;
    
    const delayMs = (apiSettings.proactiveDelay || 10) * 1000;

    const timer = setTimeout(async () => {
       // 50% chance to proactively message if idle for the specified delay
       if (Math.random() < 0.5 && currentPersona && currentPersona.allowActiveMessaging === true && !currentPersona.isOffline) {
          pendingRequests.current += 1;
          setIsTyping(pendingRequests.current > 0);
          try {
            const promptText = `[系统提示：距离上次聊天已经过了一会儿，请根据聊天记录中的上下文主动找用户说句话。你可以开启新话题，也可以对之前的对话进行补充或追问。如果你想发起收款，请包含 [REQUEST: 金额]。如果你想主动转账给用户，请包含 [TRANSFER: 金额]。必须完全符合你的人设，语气自然，像真人一样发微信。不要说太客套的话，要像真正的朋友或恋人一样自然。]`;
            const contextMessages = currentMessages.slice(-50).map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: `[ID: ${m.id}] ${m.isRecalled ? '[此消息已撤回]' : m.text}`
            }));
            const aiResponse = await fetchAiResponse(
              promptText, 
              contextMessages, 
              currentPersona, 
              apiSettings, 
              worldbook, 
              userProfile, 
              aiRef, 
              true, 
              "", 
              "gemini-3-flash-preview",
              undefined,
              currentPersona.isOffline
            );
            
            // Mark user messages as read since AI is active
            setMessages(prev => prev.map(m => (m.role === 'user' && (!m.isRead || m.status !== 'read')) ? { ...m, isRead: true, status: 'read' } : m));
            
            if (aiResponse.responseText.includes('[NO_REPLY]')) {
              pendingRequests.current -= 1;
              setIsTyping(pendingRequests.current > 0);
              return;
            }

            const processed = processAiResponseParts(aiResponse.responseText);
            const aiQuotedId = processed.quotedMessageId;

            if (processed.orderItems && processed.orderItems.length > 0 && onAiOrder) {
               onAiOrder(processed.orderItems, currentPersona.id);
            }

            const finalParts: any[] = [];
            for (const part of processed.parts) {
              if (part.msgType === 'text' && currentPersona.isSegmentResponse) {
                const segments = part.text.split(/([。！？\n!?]+)/).filter((s: string) => s.trim().length > 0);
                for (let i = 0; i < segments.length; i++) {
                  if (i > 0 && segments[i].match(/^[。！？\n!?]+$/)) {
                    finalParts[finalParts.length - 1].text += segments[i];
                  } else {
                    finalParts.push({ msgType: 'text', text: segments[i].trim() });
                  }
                }
              } else {
                finalParts.push(part);
              }
            }

            for (let i = 0; i < finalParts.length; i++) {
              const part = finalParts[i];
              const typingDelay = Math.min((part.text || '...').length * 50, 1500) + Math.random() * 500;
              setIsTyping(true);
              await new Promise(resolve => setTimeout(resolve, typingDelay));
              
              const aiMsg: Message = { 
                id: (Date.now() + Math.random()).toString(), 
                personaId: currentChatId,
                role: 'model', 
                text: part.text || '',
                msgType: part.msgType,
                amount: part.amount,
                transferNote: part.transferNote,
                transferStatus: (part.msgType === 'transfer' && !part.isRefund && !part.isReceived) ? 'pending' : undefined,
                checkPhoneStatus: part.msgType === 'checkPhoneRequest' ? 'pending' : undefined,
                relativeCard: part.relativeCard,
                sticker: part.sticker,
                isRequest: part.isRequest,
                isRefund: part.isRefund,
                isInnerVoice: part.isInnerVoice,
                timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                isRead: true,
                createdAt: Date.now(),
                quotedMessageId: i === 0 ? aiQuotedId : undefined
              };
              setMessages(prev => [...prev, aiMsg]);
            }
          } catch (e: any) {
            if (e?.message?.includes('频率限制') || e?.message?.includes('429')) {
              console.warn("Proactive message skipped due to rate limit.");
            } else {
              console.error("Proactive message error:", e);
            }
          } finally {
            pendingRequests.current -= 1;
            setIsTyping(pendingRequests.current > 0);
          }
       }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [currentMessages, currentChatId, isTyping, isLoading, currentPersona, apiSettings.proactiveDelay]);

  const handleAddSticker = () => {
    if (!newStickerName.trim() || !newStickerUrl.trim()) return;
    
    const newSticker = {
      id: Date.now().toString(),
      name: newStickerName.trim(),
      url: newStickerUrl.trim()
    };
    
    setUserProfile(prev => ({
      ...prev,
      stickers: [...(prev.stickers || []), newSticker]
    }));
    
    setNewStickerName('');
    setNewStickerUrl('');
    setShowAddStickerModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newSticker = {
          id: Date.now().toString() + Math.random(),
          name: file.name.split('.')[0],
          url: base64
        };
        setUserProfile(prev => ({
          ...prev,
          stickers: [...(prev.stickers || []), newSticker]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const processAiResponseParts = (responseText: string | { responseText: string }, aiQuotedId?: string) => {
    const text = typeof responseText === 'string' ? responseText : responseText.responseText;
    // Regexes for special tags
    const transferRegex = /[\[［【\(\{]\s*TRANSFER[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const requestRegex = /[\[［【\(\{]\s*REQUEST[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const refundRegex = /[\[［【\(\{]\s*REFUND[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const relativeCardRegex = /[\[［【\(\{]\s*RELATIVE_CARD[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const orderRegex = /[\[［【\(\{]\s*ORDER[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const stickerRegex = /[\[［【\(\{]\s*STICKER[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const musicRegex = /[\[［【\(\{]\s*MUSIC[:：]?\s*([^\]］】\)\}]+)\s*[\]］】\)\}]/i;
    const recallRegex = /[\[［【\(\{]\s*RECALL\s*[\]］】\)\}]/i;
    const checkPhoneRegex = /[\[［【\(\{]\s*ACTION[:：]?\s*CHECK_PHONE\s*[\]］】\)\}]/i;
    const imageRegex = /[\[［【\(\{]\s*ACTION[:：]?\s*IMAGE[:：]?\s*([^\]］】\)\}]+)[\]］】\)\}]/i;
    const quoteRegex = /[\[［]QUOTE[:：]\s*([^\]］]+)[\]］]/i;
    const innerVoiceRegex = /[（\(](.*?)[）\)]/g;

    // Split text by any of these tags, keeping the tags in the result
    const allTagsRegex = /([\[［【\(\{]\s*(?:TRANSFER|REQUEST|REFUND|RELATIVE_CARD|ORDER|STICKER|MUSIC|RECALL|QUOTE|ACTION[:：]?\s*CHECK_PHONE|ACTION[:：]?\s*IMAGE)[:：]?[^\]］】\)\}]+[\]］】\)\}]|\|\|\|)/gi;
    
    const rawParts = text.split(allTagsRegex).filter(p => p && p.trim() !== '|||');
    const processedParts: any[] = [];
    let currentQuotedId = aiQuotedId;
    let orderItems: string[] = [];
    let shouldRecall = false;
    let checkPhoneRequest = false;

    const parseAmountAndNote = (content: string) => {
      const parts = content.split(/[,，、]/);
      const amountStr = parts[0];
      const note = parts.slice(1).join(',').trim();
      const amount = parseFloat(amountStr.replace(/[^\d.]/g, ''));
      return { amount, note: note || undefined };
    };

    for (const part of rawParts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      if (trimmedPart.match(transferRegex)) {
        const match = trimmedPart.match(transferRegex)!;
        const { amount, note } = parseAmountAndNote(match[1]);
        processedParts.push({ msgType: 'transfer', amount, transferNote: note });
      } else if (trimmedPart.match(requestRegex)) {
        const match = trimmedPart.match(requestRegex)!;
        const { amount, note } = parseAmountAndNote(match[1]);
        processedParts.push({ msgType: 'transfer', amount, transferNote: note, isRequest: true });
      } else if (trimmedPart.match(refundRegex)) {
        const match = trimmedPart.match(refundRegex)!;
        const { amount, note } = parseAmountAndNote(match[1]);
        processedParts.push({ msgType: 'transfer', amount, transferNote: note, isRefund: true });
      } else if (trimmedPart.match(relativeCardRegex)) {
        const match = trimmedPart.match(relativeCardRegex)!;
        processedParts.push({ msgType: 'relativeCard', relativeCard: { limit: parseFloat(match[1].replace(/[^\d.]/g, '')), status: 'active' } });
      } else if (trimmedPart.match(orderRegex)) {
        const match = trimmedPart.match(orderRegex)!;
        const items = match[1].split(/[,，、]/).map(s => s.trim()).filter(s => s);
        orderItems = [...orderItems, ...items];
      } else if (trimmedPart.match(stickerRegex)) {
        const match = trimmedPart.match(stickerRegex)!;
        const seed = match[1].trim();
        if (seed.startsWith('http') || seed.startsWith('data:')) {
             processedParts.push({ msgType: 'sticker', sticker: seed });
        } else {
             const customSticker = userProfile.stickers?.find(s => s.name === seed);
             processedParts.push({ msgType: 'sticker', sticker: customSticker ? customSticker.url : `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}` });
        }
      } else if (trimmedPart.match(musicRegex)) {
        const match = trimmedPart.match(musicRegex)!;
        processedParts.push({ msgType: 'text', text: `[播放音乐: ${match[1]}]` });
      } else if (trimmedPart.match(recallRegex)) {
        shouldRecall = true;
      } else if (trimmedPart.match(checkPhoneRegex)) {
        processedParts.push({ msgType: 'checkPhoneRequest', text: '[请求查看你的手机]', checkPhoneStatus: 'pending' });
      } else if (trimmedPart.match(imageRegex)) {
        const match = trimmedPart.match(imageRegex)!;
        const imageUrl = match[1].trim();
        processedParts.push({ msgType: 'sticker', sticker: imageUrl });
      } else if (trimmedPart.match(quoteRegex)) {
        const match = trimmedPart.match(quoteRegex)!;
        currentQuotedId = match[1].trim();
      } else {
        // Clean any stray ID tags or other markers
        let cleanText = trimmedPart.replace(/[\[［]ID[:：]\s*[^\]］]+[\]］]/gi, '').trim();
        
        if (cleanText) {
          processedParts.push({ msgType: 'text', text: cleanText });
        }
      }
    }

    // If no parts were created (e.g. empty response), add a fallback
    if (processedParts.length === 0) {
      processedParts.push({ msgType: 'text', text: '...' });
    }

    return { parts: processedParts, quotedMessageId: currentQuotedId, orderItems, shouldRecall, checkPhoneRequest };
  };

  const handleBacktrack = () => {
    if (!currentChatId) return;
    const theaterId = showTheater ? activeTheaterScript?.title : undefined;
    
    setMessages(prev => {
      // Find the last message exchange for this chat
      // We want to remove the last user message and any subsequent AI messages
      let lastUserIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].personaId === currentChatId && prev[i].theaterId === theaterId && prev[i].role === 'user') {
          lastUserIndex = i;
          break;
        }
      }
      
      if (lastUserIndex === -1) return prev;
      
      // Filter out the messages from that index onwards that belong to this chat
      return prev.filter((m, idx) => {
        if (m.personaId === currentChatId && m.theaterId === theaterId && idx >= lastUserIndex) {
          return false;
        }
        return true;
      });
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64Image = event.target.result as string;
          handleSend('[图片]', 'image', undefined, undefined, undefined, undefined, undefined, base64Image);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (text: string, msgType: 'text' | 'transfer' | 'relativeCard' | 'sticker' | 'listenTogether' | 'system' | 'image' = 'text', amount?: number, transferNote?: string, relativeCard?: { limit: number; status: 'active' | 'cancelled' }, sticker?: string, theaterId?: string, imageUrl?: string) => {
    if ((!text.trim() && msgType === 'text') || !currentPersona) return;

    // Prevent double sending
    if (!theaterId) {
      setInputText('');
      if (inputRef.current) inputRef.current.value = '';
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const userMsg: Message = { 
      id: Date.now().toString(), 
      personaId: currentPersona.id, 
      role: 'user', 
      text: text.trim(), 
      msgType, 
      amount, 
      transferNote,
      relativeCard,
      sticker,
      imageUrl,
      timestamp, 
      isRead: false, 
      status: 'sent', 
      createdAt: Date.now(),
      quotedMessageId: quotedMessage?.id,
      theaterId
    };
    setMessages(prev => [...prev, userMsg]);

    if (msgType === 'listenTogether' && onStartListeningWith) {
      onStartListeningWith(currentPersona.id);
    }

    // Record transaction for user transfer
    if (msgType === 'transfer' && amount) {
      const newTx: Transaction = {
        id: Date.now().toString() + '-user',
        type: 'payment',
        amount: amount,
        description: `转账给 ${currentPersona.name}`,
        timestamp: Date.now()
      };
      setUserProfile(prev => ({
        ...prev,
        balance: (prev.balance || 0) - amount,
        transactions: [newTx, ...(prev.transactions || [])]
      }));
    }

    if (!theaterId) {
      // setInputText('') already called at start
    }
    setQuotedMessage(null);
    setShowPlusMenu(false);
    
    pendingRequests.current += 1;
    setIsTyping(pendingRequests.current > 0);

    // Clear any existing debounced response timeout
    if (debouncedAiResponseTimeout.current) {
      clearTimeout(debouncedAiResponseTimeout.current);
      debouncedAiResponseTimeout.current = null;
      pendingRequests.current = Math.max(0, pendingRequests.current - 1); // Decrement because we are replacing this request
    }

    debouncedAiResponseTimeout.current = setTimeout(async () => {
      debouncedAiResponseTimeout.current = null; // Mark as executing
      try {
        // 1. Simulate delay before AI "reads" the message
        await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 400));
        
        // Mark as read only if AI is online
        if (!currentPersona.isOffline) {
          setMessages(prev => prev.map(m => (m.role === 'user' && (!m.isRead || m.status !== 'read')) ? { ...m, isRead: true, status: 'read' } : m));
        }
        
        // If it's a transfer, show the "Received" bubble first
        if (msgType === 'transfer') {
          const receiptMsg: Message = {
            id: (Date.now() + 100).toString(),
            personaId: currentPersona.id,
            role: 'model',
            text: '', 
            msgType: 'transfer',
            amount: amount,
            transferNote: transferNote,
            isReceived: true,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            isRead: true,
            createdAt: Date.now(),
            theaterId
          };
          setMessages(prev => [...prev, receiptMsg]);
          // Small delay before typing starts
          await new Promise(resolve => setTimeout(resolve, 600));
        }

        // 2. Show typing indicator
        setIsTyping(true);

        const defaultStickers = ['大笑', '哭泣', '猫猫头', '点赞', '心碎', '思考', '开心', '难过', '生气', '爱心', '大哭', '酷', '睡觉'];
        const customStickerNames = userProfile.stickers?.map(s => s.name) || [];
        const allStickers = [...defaultStickers, ...customStickerNames].join(', ');

        let promptText = msgType === 'transfer' ? `[系统提示：用户向你转账了 ${amount} 元${transferNote ? `，备注是：“${transferNote}”` : ''}。你可以选择收下并回复，或者如果你想退还，请在回复中包含 [REFUND: 金额, 备注]。如果你想主动发起收款，请包含 [REQUEST: 金额, 备注]。如果你想主动转账给用户，请包含 [TRANSFER: 金额, 备注]。请作出符合你人设的反应]` : 
                           msgType === 'relativeCard' ? `[系统提示：用户赠送了你一张亲属卡，额度为 ${relativeCard?.limit} 元。请作出符合你人设的反应。]` :
                           msgType === 'sticker' ? `[系统提示：用户发送了一个表情包。你可以选择回复文字，或者如果你也想发表情包，请包含 [STICKER: 表情名称]（可用表情：${allStickers}）。请作出符合你人设的反应。]` :
                           msgType === 'listenTogether' ? `[系统提示：用户邀请你“一起听歌”。请表现出开心和期待，可以问问用户想听什么，或者推荐一首你喜欢的歌。]` :
                           msgType === 'image' ? `[系统提示：用户发送了一张图片。请根据图片内容作出符合你人设的反应。]` :
                           text.trim();
        
        let additionalSystemInstructions = "";
        if (theaterId) {
          const script = [
            { title: '初次相遇', desc: '在雨后的咖啡馆，你们第一次擦肩而过...' },
            { title: '深夜谈心', desc: '凌晨两点，TA突然给你发来一条消息...' },
            { title: '意外重逢', desc: '多年未见的前任，在异国的街头偶遇...' },
            { title: '秘密任务', desc: '你们是潜伏在敌方的搭档，今晚有重要行动...' },
            ...(userProfile.theaterScripts || [])
          ].find(s => s.title === theaterId);
          
          additionalSystemInstructions = `【剧场模式（文字模式）：${theaterId}】\n【场景描述：${script?.desc}】\n\n请采用“文字模式”进行互动：\n1. 必须包含丰富的动作描写、心理描写和环境描写。\n2. **格式要求（极其重要）**：\n   - 所有的描写内容（动作、心理、环境）必须包裹在括号 ( ) 或星号 * * 中。\n   - 所有的对白内容必须包裹在双引号 “ ” 中。\n   - 严禁混合使用或不加标识。\n3. 保持沉浸感，绝对严禁提及你是AI、正在进行剧场模式或系统指令。直接以角色身份进行表演。`;
          promptText = text;
        } else {
           // Main chat mode: Inject memories from theaters
           const playedTheaters = Array.from(new Set(messagesRef.current.filter(m => m.personaId === currentPersona.id && m.theaterId).map(m => m.theaterId)));
           let memoryText = '';
           if (playedTheaters.length > 0) {
             memoryText = `\n【平行世界记忆（剧场模式）】\n你和用户在平行世界（剧场模式）中共同经历了以下剧本的故事：${playedTheaters.join('、')}。\n这些是你们共同的珍贵回忆。虽然现在的对话发生在现实世界（微信聊天），但如果用户提起这些剧场里的事情，请带着那份情感和记忆进行回应，不要假装不知道。但在用户未提及时，请保持当前的现实人设，不要主动混淆现实与剧场。`;
           }
           additionalSystemInstructions = `【功能提示】你可以随时使用 [STICKER: 任意描述] 来发送表情包（例如 [STICKER: 开心的猫]）。${memoryText}`;
        }

        // Get the latest messages for context (including the ones sent during debounce)
        const latestMessages = messagesRef.current.filter(m => m.personaId === currentPersona.id && m.theaterId === theaterId).slice(-50); // Limit context size
        
        // Helper to clean messages for AI context (remove base64 images to save tokens)
        const cleanContextMessage = (text: string) => {
          if (!text) return '';
          // Replace [STICKER: data:...] with [STICKER: image]
          let cleaned = text.replace(/\[STICKER:\s*data:[^\]]+\]/g, '[STICKER: image]');
          // Strip hidden control tags
          cleaned = cleaned.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim();
          return cleaned;
        };

        const wechatContext = latestMessages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: `[ID: ${m.id}] ${m.isRecalled ? '[此消息已撤回]' : (
                   m.msgType === 'transfer' ? (
                     m.role === 'user' ? 
                       `用户向你转账了 ${m.amount} 元${m.transferNote ? `，备注是：“${m.transferNote}”` : ''}` :
                       `我向用户转账了 ${m.amount} 元${m.transferNote ? `，备注是：“${m.transferNote}”` : ''}`
                   ) : 
                   m.msgType === 'relativeCard' ? (
                     m.role === 'user' ?
                       `用户赠送了亲属卡，额度 ${m.relativeCard?.limit}` :
                       `我赠送了亲属卡，额度 ${m.relativeCard?.limit}`
                   ) :
                   m.msgType === 'music' && m.song ? `用户分享了歌曲《${m.song.title}》` :
                   m.msgType === 'listenTogether' ? `[发起了“一起听歌”邀请]` :
                   m.msgType === 'sticker' ? `[STICKER: 表情包]` :
                   m.msgType === 'image' ? `[图片]` :
                   cleanContextMessage(m.text))}`,
          imageUrl: m.imageUrl,
          timestamp: m.createdAt || 0
        }));

        // Merge XHS history if available
        const xhsHistory = xhsPrivateChats?.[currentPersona.id] || [];
        const xhsContext = xhsHistory.map(m => ({
           role: m.isMe ? 'user' : 'assistant',
           content: `[来自小红书私信] ${m.text}`,
           timestamp: m.time
        }));

        // Merge and sort
        const fullContext = [...xhsContext, ...wechatContext].sort((a, b) => a.timestamp - b.timestamp);
        
        // Take last 50
        const contextMessages = fullContext.slice(-50).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }));

        const { responseText: responseTextWithQuote, functionCalls } = await fetchAiResponse(
          promptText, 
          contextMessages, 
          currentPersona, 
          apiSettings, 
          worldbook, 
          userProfile, 
          aiRef,
          true,
          additionalSystemInstructions,
          undefined,
          undefined,
          currentPersona.isOffline
        );

        if (responseTextWithQuote.includes('[NO_REPLY]')) {
          setIsTyping(false);
          pendingRequests.current = Math.max(0, pendingRequests.current - 1);
          return;
        }
        
        let finalResponseText = responseTextWithQuote;
        
        const processed = processAiResponseParts(finalResponseText);
        const aiQuotedId = processed.quotedMessageId;

        if (processed.orderItems && processed.orderItems.length > 0 && onAiOrder) {
           onAiOrder(processed.orderItems, currentPersona.id);
        }

        let lastAiMsgId: string | undefined;

        // Flatten all parts into a single sequence of messages
        const finalParts: any[] = [];
        for (const part of processed.parts) {
          if (part.msgType === 'text' && currentPersona.isSegmentResponse) {
            const segments = part.text.split(/([。！？\n!?]+)/).filter((s: string) => s.trim().length > 0);
            for (let i = 0; i < segments.length; i++) {
              if (i > 0 && segments[i].match(/^[。！？\n!?]+$/)) {
                finalParts[finalParts.length - 1].text += segments[i];
              } else {
                finalParts.push({ msgType: 'text', text: segments[i].trim() });
              }
            }
          } else {
            finalParts.push(part);
          }
        }

        for (let i = 0; i < finalParts.length; i++) {
          const part = finalParts[i];
          const typingDelay = Math.min((part.text || '...').length * 50, 1500) + Math.random() * 500;
          setIsTyping(true);
          await new Promise(resolve => setTimeout(resolve, typingDelay));
          
          const aiMsg: Message = { 
            id: (Date.now() + Math.random()).toString(), 
            personaId: currentPersona.id,
            role: 'model', 
            text: part.text || '',
            msgType: part.msgType,
            amount: part.amount,
            transferNote: part.transferNote,
            transferStatus: (part.msgType === 'transfer' && !part.isRefund && !part.isReceived) ? 'pending' : undefined,
            checkPhoneStatus: part.msgType === 'checkPhoneRequest' ? 'pending' : undefined,
            relativeCard: part.relativeCard,
            sticker: part.sticker,
            isRequest: part.isRequest,
            isRefund: part.isRefund,
            isInnerVoice: part.isInnerVoice,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            isRead: true,
            createdAt: Date.now(),
            quotedMessageId: i === 0 ? aiQuotedId : undefined,
            theaterId
          };
          lastAiMsgId = aiMsg.id;
          setMessages(prev => [...prev, aiMsg]);

          // Record transaction for AI transfer (only if it's a refund, otherwise it's pending)
          if (part.msgType === 'transfer' && part.amount && part.isRefund) {
            const newTx: Transaction = {
              id: Date.now().toString() + '-ai',
              type: 'red_packet',
              amount: part.amount,
              description: `${currentPersona.name} 的退款`,
              timestamp: Date.now()
            };
            setUserProfile(prev => ({
              ...prev,
              balance: (prev.balance || 0) + (part.amount || 0),
              transactions: [newTx, ...(prev.transactions || [])]
            }));
          }
        }

        if ((processed.shouldRecall || Math.random() < 0.05) && lastAiMsgId) {
            const recallDelay = processed.shouldRecall ? 1000 : (2000 + Math.random() * 2000);
            setTimeout(async () => {
              const msgToRecall = messagesRef.current.find(m => m.id === lastAiMsgId);
              if (msgToRecall && (Date.now() - (msgToRecall.createdAt || Date.now()) < 120000)) {
                setMessages(prev => prev.map(m => m.id === lastAiMsgId ? { ...m, isRecalled: true } : m));
                pendingRequests.current += 1;
                setIsTyping(pendingRequests.current > 0);
                
                try {
                  const currentLatestMessages = messagesRef.current.filter(m => m.personaId === currentPersona.id).slice(-200);
                  const recallPrompt = processed.shouldRecall 
                    ? `[系统提示：你（AI角色）刚才撤回了你发出的上一条消息。请发一条新消息，可以解释一下为什么撤回（比如害羞了、说错话了、发错表情了等），然后继续聊天。语气要自然。]`
                    : `[系统提示：你（AI角色）刚才撤回了你发出的上一条消息。请发一条新消息，可以解释一下为什么撤回（比如打错字了、发错表情了等），然后继续聊天。]`;
                  
                  const recallContext = currentLatestMessages.map(m => ({
                    role: m.role === 'model' ? 'assistant' : 'user',
                    content: `[ID: ${m.id}] ${m.id === lastAiMsgId ? '[此消息已撤回]' : (m.isRecalled ? '[此消息已撤回]' : m.text)}`
                  }));
                  const aiResponse = await fetchAiResponse(recallPrompt, recallContext, currentPersona, apiSettings, worldbook, userProfile, aiRef);
                  const cleanedRecallResponse = aiResponse.responseText.replace(/\[ID:\s*[^\]]+\]/gi, '').trim();
                  
                  const newAiMsg: Message = { 
                    id: (Date.now() + 2).toString(), 
                    personaId: currentPersona.id,
                    role: 'model', 
                    text: cleanedRecallResponse,
                    msgType: 'text',
                    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    isRead: true,
                    createdAt: Date.now(),
                    theaterId
                  };
                  setMessages(prev => [...prev, newAiMsg]);
                } catch (e) {
                  console.error("AI recall error:", e);
                } finally {
                  pendingRequests.current = Math.max(0, pendingRequests.current - 1);
                  setIsTyping(pendingRequests.current > 0);
                }
              }
            }, recallDelay);
          }

      } catch (error: any) {
        if (error?.message?.includes('频率限制') || error?.message?.includes('429')) {
          console.warn("Chat rate limited.");
          setMessages(prev => [...prev, { 
            id: Date.now().toString(), 
            personaId: currentPersona.id, 
            role: 'model', 
            text: "(太快啦，让我歇会儿~ 频率限制中)", 
            msgType: 'system', 
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }), 
            isRead: true,
            theaterId
          }]);
        } else {
          console.error("Chat error:", error);
          let errorMsg = `错误: ${error.message}`;
          if (error.message?.includes('配额已用尽') || error.message?.includes('quota')) {
            errorMsg = "API 配额已用尽，请在设置中更换模型或 API Key。";
          }
          setMessages(prev => [...prev, { 
            id: Date.now().toString(), 
            personaId: currentPersona.id, 
            role: 'model', 
            text: errorMsg, 
            msgType: 'system', 
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }), 
            isRead: true,
            theaterId
          }]);
        }
      } finally {
        pendingRequests.current = Math.max(0, pendingRequests.current - 1);
        setIsTyping(pendingRequests.current > 0);
      }
    }, 10000); // 10 second debounce

    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === userMsg.id && m.status === 'sent' ? { ...m, status: 'delivered' } : m));
    }, 600);
  };

  const handleRecall = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    // Safety check: only allow recall within 2 minutes
    const timeDiff = Date.now() - (msg.createdAt || Date.now());
    if (timeDiff > 120000) {
      alert('超过2分钟的消息不能撤回');
      setActiveMessageMenu(null);
      return;
    }

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRecalled: true } : m));
    setActiveMessageMenu(null);

    // If user recalled a message, notify AI
    if (msg.role === 'user' && currentPersona && !currentPersona.isBlocked) {
      pendingRequests.current += 1;
      setIsTyping(pendingRequests.current > 0);
      try {
        const recallPrompt = `[系统提示：用户刚才撤回了他发出的上一条消息。请作出符合你人设的反应，比如问问用户为什么撤回，或者表示遗憾等。语气要自然，像真人一样。]`;
        const contextMessages = currentMessages.slice(-50).map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: `[ID: ${m.id}] ${m.id === msgId ? '[此消息已撤回]' : (m.isRecalled ? '[此消息已撤回]' : m.text)}`
        }));
        const aiResponse = await fetchAiResponse(
          recallPrompt, 
          contextMessages, 
          currentPersona, 
          apiSettings, 
          worldbook, 
          userProfile, 
          aiRef,
          true,
          "",
          undefined,
          undefined,
          currentPersona.isOffline
        );
        
        // Mark user messages as read only if AI is online
        if (!currentPersona.isOffline) {
          setMessages(prev => prev.map(m => (m.role === 'user' && (!m.isRead || m.status !== 'read')) ? { ...m, isRead: true, status: 'read' } : m));
        }
        
        const processed = processAiResponseParts(aiResponse.responseText);
        const aiQuotedId = processed.quotedMessageId;

        if (processed.orderItems && processed.orderItems.length > 0 && onAiOrder) {
           onAiOrder(processed.orderItems, currentPersona.id);
        }

        for (let i = 0; i < processed.parts.length; i++) {
          const part = processed.parts[i];
          const aiMsg: Message = { 
            id: (Date.now() + i + 1).toString(), 
            personaId: currentPersona.id,
            role: 'model', 
            text: part.text || '',
            msgType: part.msgType,
            amount: part.amount,
            transferNote: part.transferNote,
            transferStatus: (part.msgType === 'transfer' && !part.isRefund && !part.isReceived) ? 'pending' : undefined,
            checkPhoneStatus: part.msgType === 'checkPhoneRequest' ? 'pending' : undefined,
            relativeCard: part.relativeCard,
            sticker: part.sticker,
            isRequest: part.isRequest,
            isRefund: part.isRefund,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            isRead: true,
            createdAt: Date.now(),
            quotedMessageId: i === 0 ? aiQuotedId : undefined
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      } catch (e) {
        console.error("AI recall response error:", e);
      } finally {
        pendingRequests.current = Math.max(0, pendingRequests.current - 1);
        setIsTyping(pendingRequests.current > 0);
      }
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActiveMessageMenu(null);
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditInput(message.text);
    setActiveMessageMenu(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessageId) return;
    setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, text: editInput } : m));
    setEditingMessageId(null);
    setEditInput('');
  };

  const isPatting = useRef(false);
  const handlePat = async (target: 'user' | 'model') => {
    if (!currentPersona || isPatting.current) return;
    isPatting.current = true;
    
    const now = new Date();
    const timestamp = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let patText = '';
    if (target === 'model') {
      const suffix = currentPersona.patSuffix || '肩膀';
      patText = `我拍了拍"${currentPersona.name}"的${suffix}`;
    } else {
      const suffix = userProfile.patSuffix || '肩膀';
      patText = `我拍了拍自己的${suffix}`;
    }

    const sysMsg: Message = {
      id: Date.now().toString(),
      personaId: currentPersona.id,
      role: 'user', // We use user role for alignment, but msgType system will center it
      text: patText,
      msgType: 'system',
      timestamp,
      createdAt: Date.now()
    };
    
    setMessages(prev => [...prev, sysMsg]);

    if (target === 'model') {
      pendingRequests.current += 1;
      setIsTyping(pendingRequests.current > 0);
      try {
        const promptText = `[系统提示：用户拍了拍你（${patText}）。请作出符合你人设的反应，可以是一句话，也可以是一个动作。]`;
        const contextMessages = currentMessages.slice(-5).map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: `[ID: ${m.id}] ${m.text}`
        }));
        
        const aiResponse = await fetchAiResponse(
          promptText, 
          contextMessages, 
          currentPersona, 
          apiSettings, 
          worldbook, 
          userProfile, 
          aiRef, 
          true, 
          "", 
          "gemini-3-flash-preview",
          undefined,
          currentPersona.isOffline
        );
        
        // Mark user messages as read only if AI is online
        if (!currentPersona.isOffline) {
          setMessages(prev => prev.map(m => (m.role === 'user' && (!m.isRead || m.status !== 'read')) ? { ...m, isRead: true, status: 'read' } : m));
        }
        
        const typingDelay = Math.min(aiResponse.responseText.length * 100, 3000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, typingDelay));
        
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          personaId: currentPersona.id,
          role: 'model', 
          text: aiResponse.responseText,
          msgType: 'text',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          isRead: true,
          createdAt: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
        console.error("AI pat response error:", e);
      } finally {
        isPatting.current = false;
        pendingRequests.current -= 1;
        setIsTyping(pendingRequests.current > 0);
      }
    } else {
      isPatting.current = false;
    }
  };

  const handleAvatarClick = async (msg: Message) => {
    if (msg.role !== 'model') return;

    // Toggle if already exists
    if (msg.innerVoice) {
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, showInnerVoice: !m.showInnerVoice } : m
      ));
      return;
    }

    // Generate inner voice if not exists
    pendingRequests.current += 1;
    // Don't show typing indicator for inner voice to avoid confusing the user
    // setIsTyping(true); 

    try {
      const promptText = `[系统提示：用户想知道你此刻的心声（内心真实想法，不要发出来，只是在心里默默想的）。请针对你刚才说的这句话：“${msg.text}”，用内心独白的语气补充你的真实想法。简短一点，不要超过30个字。严禁包含任何 [QUOTE: xxx], [TRANSFER: xxx], [REQUEST: xxx], [STICKER: xxx] 等特殊指令标签。请务必在心声开头加上一个表情符号来代表此刻的心情，格式为：[MOOD: 😡] 心声内容。例如：[MOOD: 😡] 真是气死我了。]`;
      
      // Context: previous messages up to this message
      const msgIndex = currentMessages.findIndex(m => m.id === msg.id);
      const contextMessages = currentMessages.slice(Math.max(0, msgIndex - 5), msgIndex + 1).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: `[ID: ${m.id}] ${m.text}`
      }));
      
      const aiResponse = await fetchAiResponse(
        promptText, 
        contextMessages, 
        currentPersona, 
        apiSettings, 
        worldbook, 
        userProfile, 
        aiRef, 
        true, 
        "", 
        "gemini-3-flash-preview",
        undefined,
        currentPersona.isOffline
      );
      const processed = processAiResponseParts(aiResponse.responseText);
      let innerVoiceText = processed.parts.map(p => p.text).join(' ');
      
      // Extract mood
      let mood = null;
      const moodMatch = innerVoiceText.match(/\[MOOD:\s*([^\]]+)\]/);
      if (moodMatch) {
        mood = moodMatch[1].trim();
        innerVoiceText = innerVoiceText.replace(/\[MOOD:\s*[^\]]+\]/, '').trim();
      }

      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, innerVoice: innerVoiceText, innerVoiceMood: mood || undefined, showInnerVoice: true } : m
      ));

    } catch (e) {
      console.error("AI inner voice error:", e);
    } finally {
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
    }
  };

  const handleRegenerate = async () => {
    if (!currentPersona || currentMessages.length === 0) return;

    // Find the last user message
    const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
    if (lastUserMsgIndex === -1) return;

    const lastUserMsg = currentMessages[lastUserMsgIndex];
    
    // Remove all AI messages that came after the last user message
    const msgsToRemove = currentMessages.slice(lastUserMsgIndex + 1);
    if (msgsToRemove.length > 0) {
      const idsToRemove = new Set(msgsToRemove.map(m => m.id));
      setMessages(prev => prev.filter(m => !idsToRemove.has(m.id)));
    }
    
    pendingRequests.current += 1;
    setIsLoading(true); // Use isLoading for the button spin
    setIsTyping(true); // Also show typing bubble

    try {
      const promptText = lastUserMsg.msgType === 'transfer' ? `[系统提示：用户向你转账了 ${lastUserMsg.amount} 元。你可以选择收下并回复，或者如果你想退还，请在回复中包含 [REFUND: 金额, 备注]。如果你想主动发起收款，请包含 [REQUEST: 金额, 备注]。如果你想主动转账给用户，请包含 [TRANSFER: 金额, 备注]。请作出符合你人设的反应]` : 
                         lastUserMsg.msgType === 'music' && lastUserMsg.song ? `[系统提示：用户分享了歌曲《${lastUserMsg.song.title}》。请作出符合你人设的反应]` :
                         `[系统提示：用户说：${lastUserMsg.text}。你可以选择正常回复，或者如果你想发起收款，请包含 [REQUEST: 金额, 备注]。如果你想主动转账给用户，请包含 [TRANSFER: 金额, 备注]。如果你想赠送亲属卡，请包含 [RELATIVE_CARD: 额度]。请作出符合你人设的反应。注意：不要用文字描述转账/赠送等动作，必须使用对应的标签。]`;
      
      // Include more context (up to 50 messages) to ensure AI knows the history
      const contextMessages = currentMessages.slice(Math.max(0, lastUserMsgIndex - 50), lastUserMsgIndex).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: `[ID: ${m.id}] ${m.msgType === 'transfer' ? (
          m.role === 'user' ? 
            `用户向你转账了 ${m.amount} 元` : 
            `我向用户转账了 ${m.amount} 元`
        ) : 
        m.msgType === 'music' && m.song ? `用户分享了歌曲《${m.song.title}》` :
        m.text}`
      }));

      const aiResponse = await fetchAiResponse(
        promptText, 
        contextMessages, 
        currentPersona, 
        apiSettings, 
        worldbook, 
        userProfile, 
        aiRef,
        true,
        "",
        undefined,
        undefined,
        currentPersona.isOffline
      );
      
      // Mark user messages as read only if AI is online
      if (!currentPersona.isOffline) {
        setMessages(prev => prev.map(m => (m.role === 'user' && (!m.isRead || m.status !== 'read')) ? { ...m, isRead: true, status: 'read' } : m));
      }
      
      let finalResponseText = aiResponse.responseText;
      
      const processed = processAiResponseParts(finalResponseText);
      const aiQuotedId = processed.quotedMessageId;

      if (processed.orderItems && processed.orderItems.length > 0 && onAiOrder) {
         onAiOrder(processed.orderItems, currentPersona.id);
      }

      const finalParts: any[] = [];
      for (const part of processed.parts) {
        if (part.msgType === 'text' && currentPersona.isSegmentResponse) {
          const segments = part.text.split(/([。！？\n!?]+)/).filter((s: string) => s.trim().length > 0);
          for (let i = 0; i < segments.length; i++) {
            if (i > 0 && segments[i].match(/^[。！？\n!?]+$/)) {
              finalParts[finalParts.length - 1].text += segments[i];
            } else {
              finalParts.push({ msgType: 'text', text: segments[i].trim() });
            }
          }
        } else {
          finalParts.push(part);
        }
      }

      for (let i = 0; i < finalParts.length; i++) {
        const part = finalParts[i];
        const typingDelay = Math.min((part.text || '...').length * 50, 1500) + Math.random() * 500;
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, typingDelay));
        
        const aiMsg: Message = { 
          id: (Date.now() + Math.random()).toString(), 
          personaId: currentPersona.id,
          role: 'model', 
          text: part.text || '',
          msgType: part.msgType,
          amount: part.amount,
          transferNote: part.transferNote,
          transferStatus: (part.msgType === 'transfer' && !part.isRefund && !part.isReceived) ? 'pending' : undefined,
          checkPhoneStatus: part.msgType === 'checkPhoneRequest' ? 'pending' : undefined,
          relativeCard: part.relativeCard,
          sticker: part.sticker,
          isRequest: part.isRequest,
          isRefund: part.isRefund,
          isInnerVoice: part.isInnerVoice,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          isRead: true,
          createdAt: Date.now(),
          quotedMessageId: i === 0 ? aiQuotedId : undefined
        };
        
        setMessages(prev => {
          return [...prev, aiMsg];
        });
      }
    } catch (error: any) {
      console.error("Regenerate error:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), personaId: currentPersona.id, role: 'model', text: `错误: ${error.message}`, timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }), isRead: true }]);
    } finally {
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
      setIsLoading(false);
      setIsTyping(pendingRequests.current > 0);
    }
  };

  const handleCheckPhoneResponse = (msgId: string, accept: boolean) => {
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, checkPhoneStatus: accept ? 'accepted' : 'rejected' } : m
    ));
    
    if (accept) {
      // Create a summary of recent messages to provide context
      const recentMessages = messages.slice(-10).map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.text}`).join('\n');
      
      const systemPrompt = `[系统提示：用户允许了你查看TA的手机。
这是你们最近的聊天记录：
${recentMessages}

【沉浸感查岗规则 - 必读】
1. 你现在正在“看”用户的手机。你可以自由发挥，合理“虚构”你在TA手机里看到的内容（例如：和其他人的聊天记录、搜索记录、相册照片、外卖订单等），以此来和用户进行沉浸式的互动或“找茬”。
2. ⚠️ 绝对禁止虚构不存在的App！只能提及现实中真实存在且常用的App（如：微信、抖音、淘宝、美团、小红书等），或者使用通用词汇（如：相册、浏览器、备忘录）。
3. ⚠️ 绝对禁止虚构与“你（AI自己）”相关的、且没有在聊天记录中真实发生过的事情！例如：绝对不要说“我看到你给我买了礼物/给我转了账”，除非用户在聊天中真的这么做了。这种虚假的互动会严重破坏沉浸感。
4. 如果你要“找茬”，请找一些生活化的、有代入感的细节。例如：
   - “这个叫‘小美’的人是谁？你们为什么聊到半夜？”
   - “你相册里怎么存了这么多奇怪的表情包？”
   - “你给我的微信备注怎么连个爱心都没有？”
   - “你刚才明明在玩手机（屏幕使用时间显示），为什么回我消息那么慢？”
5. 请务必使用 [ACTION:IMAGE:描述] 标签生成一张你看到的手机屏幕截图（例如：[ACTION:IMAGE:一张手机屏幕截图，显示着用户和一个叫小美的女生的微信聊天记录]），然后把截图发给用户并直接质问或评论。
6. 如果你觉得没问题，也可以乖乖把手机还给用户，并根据你的人设撒娇或表达满意。]`;
      
      handleSend(systemPrompt, 'system');
    } else {
      handleSend("[系统提示：用户拒绝了你查看TA手机的请求。请根据你的人设作出反应（例如：生气、怀疑、撒娇等）。]", 'system');
    }
  };

  const handleTransferClick = () => {
    setShowTransferModal(true);
  };

  const confirmTransfer = () => {
    const amount = Number(transferAmount);
    if (amount && !isNaN(amount)) {
      if ((userProfile.balance || 0) < amount) {
        alert('余额不足，请充值');
        return;
      }

      const newTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'transfer',
        amount: amount,
        description: `转账给${currentPersona?.name || '朋友'}${transferNote ? ` (${transferNote})` : ''}`,
        timestamp: Date.now()
      };

      setUserProfile(prev => ({
        ...prev,
        balance: (prev.balance || 0) - amount,
        transactions: [newTransaction, ...(prev.transactions || [])]
      }));

      handleSend("", 'transfer', amount, transferNote);
    }
    setShowTransferModal(false);
    setTransferAmount('520');
    setTransferNote('');
  };

  const confirmRelativeCard = () => {
    const limit = Number(relativeCardLimit);
    if (limit && !isNaN(limit)) {
      handleSend("", 'relativeCard', undefined, undefined, { limit, status: 'active' });
    }
    setShowRelativeCardModal(false);
    setRelativeCardLimit('1000');
  };

  const handleBlockPersona = () => {
    if (currentChatId) {
      setPersonas(prev => prev.map(p => p.id === currentChatId ? { ...p, isBlocked: !p.isBlocked } : p));
      setShowChatSettings(false);
    }
  };

  const handleShowPersonaMoments = () => {
    if (!currentPersona) return;
    setShowPersonaMomentsId(currentPersona.id);
    setShowChatSettings(false);
  };

  const handleDeleteMoment = (momentId: string) => {
    setMoments(prev => prev.filter(m => m.id !== momentId));
  };

  const handleDeletePersona = () => {
    if (currentChatId) {
      setPersonas(prev => prev.filter(p => p.id !== currentChatId));
      setMessages(prev => prev.filter(m => m.personaId !== currentChatId));
      setCurrentChatId(null);
      setShowChatSettings(false);
    }
  };

  const handleOpenTheater = () => {
    setShowTheater(true);
    setActiveTheaterScript(null);
    setShowChatSettings(false);
  };

  const handleAddFriend = () => {
    if (!newFriendName.trim()) return;
    const newPersona: Persona = {
      id: Date.now().toString(),
      name: newFriendName.trim(),
      instructions: newFriendPrompt.trim() || '你是一个新朋友。',
    };
    setPersonas(prev => [...prev, newPersona]);
    setShowAddFriend(false);
    setNewFriendName('');
    setNewFriendPrompt('');
  };

  const handleOpenPersonaSettings = () => {
    const specificSettings = userProfile.personaSpecificSettings?.[currentChatId!] || {};
    // Only show specific persona if it exists, otherwise empty (implying fallback to global)
    setTempUserPersona(specificSettings.userPersona || '');
    setShowPersonaSettings(true);
    setShowChatSettings(false);
  };

  const handleSavePersonaSettings = () => {
    if (!currentChatId) return;
    
    setUserProfile(prev => ({
      ...prev,
      personaSpecificSettings: {
        ...prev.personaSpecificSettings,
        [currentChatId]: {
          ...prev.personaSpecificSettings?.[currentChatId],
          userPersona: tempUserPersona
        }
      }
    }));
    setShowPersonaSettings(false);
  };

  // --- Moments Handlers ---
  const handleToggleLike = (momentId: string) => {
    setMoments(prev => prev.map(m => {
      if (m.id === momentId) {
        const hasLiked = m.likedByIds.includes('user');
        const newLikedBy = hasLiked ? m.likedByIds.filter(u => u !== 'user') : [...m.likedByIds, 'user'];
        return { ...m, likedByIds: newLikedBy };
      }
      return m;
    }));
  };

  const handleAddComment = async (momentId: string) => {
    if (!commentInput.trim() || aiReplyingMomentId) return;

    const targetMoment = moments.find(m => m.id === momentId);
    if (!targetMoment) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      authorId: 'user',
      text: commentInput.trim(),
      timestamp: '刚刚',
      replyToId: replyToId || undefined,
      createdAt: Date.now()
    };

    setMoments(prev => prev.map(m => 
      m.id === momentId ? { ...m, comments: [...m.comments, newComment] } : m
    ));
    setCommentInput('');
    setReplyToId(null);
    // Keep commentingMomentId to allow continuous commenting

    // If the moment was posted by an AI, the AI should reply
    if (targetMoment.authorId !== 'user') {
      const authorPersona = personas.find(p => p.id === targetMoment.authorId);
      if (!authorPersona) return;

      setAiReplyingMomentId(momentId);
      try {
        const promptText = `[系统提示：你在朋友圈发了动态：“${targetMoment.text}”，用户评论了你：“${newComment.text}”。请直接输出回复用户的内容，符合你的人设，不要带引号，不要带“回复xx”等前缀。]`;
        const momentsApiSettings = {
          apiUrl: apiSettings.momentsApiUrl || apiSettings.apiUrl,
          apiKey: apiSettings.momentsApiKey || apiSettings.apiKey,
          model: apiSettings.momentsModel || apiSettings.model
        };
        const aiResponse = await fetchAiResponse(promptText, [], authorPersona, apiSettings, worldbook, userProfile, aiRef, true, "", undefined, momentsApiSettings);
        const responseText = aiResponse.responseText;
        
        const aiReply: Comment = {
          id: (Date.now() + 1).toString(),
          authorId: authorPersona.id,
          text: responseText,
          timestamp: '刚刚',
          replyToId: 'user',
          createdAt: Date.now()
        };
        
        setMoments(prev => prev.map(m => 
          m.id === momentId ? { ...m, comments: [...m.comments, aiReply] } : m
        ));
      } catch (error) {
        console.error("Comment reply error:", error);
      } finally {
        setAiReplyingMomentId(null);
      }
    }
  };

  const handleDeleteComment = (momentId: string, commentId: string) => {
    setMoments(prev => prev.map(m => {
      if (m.id === momentId) {
        return { ...m, comments: m.comments.filter(c => c.id !== commentId) };
      }
      return m;
    }));
  };

  const handlePostMoment = async () => {
    if (!newMomentText.trim() || isAiProcessingMoment) return;

    const newMoment: Moment = {
      id: Date.now().toString(),
      authorId: 'user',
      text: newMomentText.trim(),
      timestamp: '刚刚',
      createdAt: Date.now(),
      likedByIds: [],
      comments: []
    };

    setMoments(prev => [newMoment, ...prev]);
    setNewMomentText('');
    setIsPostingMoment(false);
    setIsAiProcessingMoment(true);

    // Let all personas react to the new moment
    for (const persona of personas) {
      try {
        const promptText = `[系统提示：用户在朋友圈发了一条动态：“${newMoment.text}”。请决定你是否要点赞或评论。如果要点赞，请回复"LIKE"。如果要评论，请直接回复评论内容。如果你不想理会，请回复"IGNORE"。请只回复这三种情况之一，不要有其他多余的字。]`;
        const momentsApiSettings = {
          apiUrl: apiSettings.momentsApiUrl || apiSettings.apiUrl,
          apiKey: apiSettings.momentsApiKey || apiSettings.apiKey,
          model: apiSettings.momentsModel || apiSettings.model
        };
        const aiResponse = await fetchAiResponse(promptText, [], persona, apiSettings, worldbook, userProfile, aiRef, true, "", undefined, momentsApiSettings);
        
        const aiAction = aiResponse.responseText.trim();
        
        if (aiAction.includes('LIKE')) {
          setMoments(prev => prev.map(m => 
            m.id === newMoment.id ? { ...m, likedByIds: [...m.likedByIds, persona.id] } : m
          ));
        } else if (!aiAction.includes('IGNORE') && aiAction.length > 0) {
          const aiComment: Comment = {
            id: Date.now().toString() + Math.random(),
            authorId: persona.id,
            text: aiAction,
            timestamp: '刚刚',
            createdAt: Date.now()
          };
          setMoments(prev => prev.map(m => 
            m.id === newMoment.id ? { ...m, comments: [...m.comments, aiComment] } : m
          ));
        }
      } catch (error) {
        console.error(`AI processing moment error for ${persona.name}:`, error);
      }
    }
    setIsAiProcessingMoment(false);
  };

  return (
    <div className="w-full h-full bg-neutral-100 flex flex-col pt-20">
      {/* Header */}
      <div className="h-12 flex items-center px-2 bg-neutral-100 border-b border-neutral-200 shrink-0 z-[70]">
        {activeTab === 'chat' && currentChatId ? (
          <button onClick={() => setCurrentChatId(null)} className="text-neutral-800 p-2 active:opacity-70 flex items-center z-50">
            <ChevronLeft size={24} />
          </button>
        ) : activeTab === 'theater' ? (
          <button onClick={() => setActiveTab('chat')} className="text-neutral-800 p-2 active:opacity-70 flex items-center z-50">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button onClick={onBack} className="text-neutral-800 p-2 active:opacity-70 flex items-center z-50">
            <ChevronLeft size={24} />
          </button>
        )}
        
        <div className="flex-1 text-center pr-2">
          <h1 className="font-semibold text-neutral-900 text-[16px]">
            {activeTab === 'chat' 
              ? (currentChatId ? currentPersona?.name : '微信') 
              : activeTab === 'contacts' ? '通讯录'
              : activeTab === 'theater' ? '剧场'
              : activeTab === 'moments' ? '朋友圈' : '收藏'}
          </h1>
          {activeTab === 'chat' && currentChatId && (
            <div className="text-[11px] text-neutral-500">
              {(() => {
                if (isTyping) return '对方正在输入...';
                return currentPersona?.isOffline ? '离线' : '在线';
              })()}
            </div>
          )}
        </div>

        {activeTab === 'chat' && !currentChatId && (
          <div className="flex items-center gap-1 z-50">
            <button 
              onClick={() => {
                setTempAvatarFrame(userProfile.avatarFrame || '');
                setTempAvatarFrameScale(userProfile.avatarFrameScale || 1);
                setTempAvatarFrameX(userProfile.avatarFrameX || 0);
                setTempAvatarFrameY(userProfile.avatarFrameY || 0);
                setShowAvatarFrameModal(true);
              }} 
              className="p-2 text-neutral-800"
            >
              <User size={24} />
            </button>
            <button onClick={() => setShowAddFriend(true)} className="p-2 text-neutral-800">
              <Plus size={24} />
            </button>
          </div>
        )}
        {activeTab === 'contacts' && (
          <button onClick={() => setShowAddFriend(true)} className="p-2 text-neutral-800 z-50">
            <UserPlus size={20} />
          </button>
        )}
        {activeTab === 'chat' && currentChatId && (
          <div className="flex items-center">
            <button onClick={() => setShowAiPhone(true)} className="p-2 text-neutral-800 z-50">
              <Smartphone size={20} />
            </button>
            <button onClick={() => setShowChatSettings(!showChatSettings)} className="p-2 text-neutral-800 relative z-50">
              <MoreHorizontal size={20} />
              {showChatSettings && (
                <div className="absolute top-10 right-2 w-32 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
                  <div onClick={handleOpenTheater} className="px-4 py-2 text-[14px] text-neutral-800 flex items-center gap-2 active:bg-neutral-100 cursor-pointer">
                    <Film size={16} /> 剧场
                  </div>
                  <div onClick={handleOpenPersonaSettings} className="px-4 py-2 text-[14px] text-neutral-800 flex items-center gap-2 active:bg-neutral-100 cursor-pointer">
                    <Settings size={16} /> 我的人设
                  </div>
                  <div onClick={handleShowPersonaMoments} className="px-4 py-2 text-[14px] text-neutral-800 flex items-center gap-2 active:bg-neutral-100 cursor-pointer">
                    <Camera size={16} /> 朋友圈
                  </div>
                  <div onClick={handleDeletePersona} className="px-4 py-2 text-[14px] text-red-500 flex items-center gap-2 active:bg-neutral-100 cursor-pointer">
                    <Trash2 size={16} /> 删除好友
                  </div>
                  <div onClick={handleBlockPersona} className="px-4 py-2 text-[14px] text-red-500 flex items-center gap-2 active:bg-neutral-100 cursor-pointer">
                    <Ban size={16} /> {currentPersona?.isBlocked ? '解除拉黑' : '拉黑'}
                  </div>
                </div>
              )}
            </button>
          </div>
        )}
        {activeTab === 'moments' && (
          <button onClick={() => setIsPostingMoment(true)} className="p-2 text-neutral-800">
            <Camera size={20} />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Chat List View */}
        {activeTab === 'chat' && !currentChatId && (
          <div className="absolute inset-0 bg-white overflow-y-auto pb-[80px]">
            <ChatListView 
              personas={personas}
              messages={messages}
              userProfile={userProfile}
              setCurrentChatId={setCurrentChatId}
              defaultAiAvatar={defaultAiAvatar}
              formatRelativeTime={formatRelativeTime}
            />
          </div>
        )}

        {/* Theater Main View */}
        {activeTab === 'theater' && (
          <div className="absolute inset-0 overflow-y-auto bg-[#f7f7f7] pb-[80px]">
            <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white mb-4">
              <h2 className="text-2xl font-bold mb-2">星光剧场</h2>
              <p className="text-white/70 text-sm">选择一位角色，开启属于你们的电影人生</p>
            </div>
            
            <div className="px-4 space-y-4">
              {personas.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    setCurrentChatId(p.id);
                    setShowTheater(true);
                  }}
                  className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border border-neutral-100"
                >
                  <div className="relative shrink-0">
                    <img src={p.avatarUrl || defaultAiAvatar} className="w-16 h-16 rounded-2xl object-cover" alt="avatar" />
                    {userProfile.avatarFrame && (
                      <img 
                        src={userProfile.avatarFrame} 
                        className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
                        alt="frame"
                        style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', transform: `translate(${userProfile.avatarFrameX || 0}px, ${userProfile.avatarFrameY || 0}px) scale(${userProfile.avatarFrameScale || 1})` }}
                      />
                    )}
                    {userProfile.avatarPendant && (
                      <img 
                        src={userProfile.avatarPendant} 
                        className="absolute -top-1 -right-1 w-6 h-6 object-contain pointer-events-none z-20 select-none"
                        alt="pendant"
                      />
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white border-2 border-white z-20">
                      <Play size={12} fill="currentColor" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-neutral-800">{p.name}</h3>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">{p.instructions.slice(0, 50)}...</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded-full font-medium">沉浸式</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-full font-medium">多剧本</span>
                    </div>
                  </div>
                  <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts View */}
        {activeTab === 'contacts' && (
          <div className="absolute inset-0 overflow-y-auto bg-white pb-[80px]">
            <div className="p-3 border-b border-neutral-100 bg-neutral-50 flex items-center gap-3 active:bg-neutral-100 cursor-pointer" onClick={() => setShowAddFriend(true)}>
              <div className="w-10 h-10 bg-orange-400 rounded-lg flex items-center justify-center text-white">
                <UserPlus size={20} />
              </div>
              <span className="text-[15px] font-medium text-neutral-800">新的朋友</span>
            </div>
            
            <div className="px-3 py-1 bg-neutral-100 text-[12px] text-neutral-500 font-medium">星标朋友</div>
            {personas.map(p => (
              <div 
                key={p.id} 
                onClick={() => {
                  setActiveTab('chat');
                  setCurrentChatId(p.id);
                }}
                className="flex items-center gap-3 p-3 border-b border-neutral-100 active:bg-neutral-50 cursor-pointer"
              >
                <div className="relative shrink-0">
                  <img src={p.avatarUrl || defaultAiAvatar} className="w-10 h-10 rounded-lg object-cover" alt="avatar" />
                  {p.avatarFrame && (
                    <img 
                      src={p.avatarFrame} 
                      className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
                      alt="frame"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', transform: `translate(${p.avatarFrameX || 0}px, ${p.avatarFrameY || 0}px) scale(${p.avatarFrameScale || 1})` }}
                    />
                  )}
                  {p.avatarPendant && (
                    <img 
                      src={p.avatarPendant} 
                      className="absolute -top-1 -right-1 w-5 h-5 object-contain pointer-events-none z-20 select-none"
                      alt="pendant"
                    />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <h3 className="text-[16px] font-medium text-neutral-900">{p.name}</h3>
                  {p.isBlocked && <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">已拉黑</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Direct Message View */}
        {activeTab === 'chat' && currentChatId && (
          <div 
            className="absolute inset-0 flex flex-col bg-neutral-100" 
            onClick={() => setShowChatSettings(false)}
            style={{
              backgroundImage: theme.chatBg ? `url(${theme.chatBg})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Mini Music Widget */}
            {listeningWithPersonaId && currentSong && (
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={onMusicClick}
                className="mx-4 mt-4 p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-3 cursor-pointer z-30 relative"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden relative">
                  <img src={currentSong.cover} className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} alt="cover" />
                  {isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="flex gap-0.5 items-end h-3">
                        <div className="w-0.5 bg-white animate-music-bar-1" />
                        <div className="w-0.5 bg-white animate-music-bar-2" />
                        <div className="w-0.5 bg-white animate-music-bar-3" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-neutral-900 truncate">{currentSong.title}</h4>
                  <p className="text-xs text-neutral-500 truncate">与 {personas.find(p => p.id === listeningWithPersonaId)?.name} 一起听</p>
                </div>
                <Music className="w-4 h-4 text-indigo-500 animate-pulse" />
              </motion.div>
            )}

            <div className="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 pb-8 pt-4" onScroll={handleScroll}>
              {currentMessages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm text-center px-6">
                  和 {currentPersona?.name || '你的 AI'} 打个招呼吧！
                </div>
              )}
              {currentMessages.slice(-100).map((msg) => {
                if (msg.isRecalled) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="text-[12px] text-neutral-400 bg-neutral-200/50 px-2 py-1 rounded-md">
                        {msg.role === 'user' ? '你' : currentPersona?.name}撤回了一条消息
                      </span>
                    </div>
                  );
                }

                if (msg.msgType === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="text-[12px] text-neutral-400 bg-neutral-200/50 px-2 py-1 rounded-md">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                if (msg.msgType === 'thought') {
                  return null; // Removed redundant inner voice beautification
                }

                let parsedUserCss = {};
                let parsedAiCss = {};
                try {
                  if (theme.chatBubbleUserCss) parsedUserCss = JSON.parse(theme.chatBubbleUserCss);
                } catch (e) {}
                try {
                  if (theme.chatBubbleAiCss) parsedAiCss = JSON.parse(theme.chatBubbleAiCss);
                } catch (e) {}

                return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start relative`}>
                  {msg.role === 'model' && (
                    <div className="relative mr-3 shrink-0 cursor-pointer active:scale-95 transition-transform" onClick={() => handleAvatarClick(msg)} onDoubleClick={() => handlePat('model')}>
                    <div className="relative w-10 h-10 shrink-0">
                      <img 
                        src={currentPersona?.avatarUrl || defaultAiAvatar} 
                        className="w-10 h-10 rounded-lg object-cover" 
                        alt="avatar" 
                      />
                      {currentPersona?.avatarFrame && (
                        <img 
                          src={currentPersona.avatarFrame} 
                          className="absolute -top-2 -left-2 w-14 h-14 pointer-events-none z-10 select-none"
                          alt="frame"
                        />
                      )}
                      {currentPersona?.avatarPendant && (
                        <img 
                          src={currentPersona.avatarPendant} 
                          className="absolute -top-1 -right-1 w-5 h-5 object-contain pointer-events-none z-20 select-none"
                          alt="pendant"
                        />
                      )}
                    </div>
                  </div>
                  )}
                  
                  {msg.role === 'user' && (
                    <div className="flex flex-col items-end mr-2 justify-end pb-1 shrink-0">
                      {msg.timestamp && <span className="text-[10px] text-neutral-400 mb-0.5">{msg.timestamp}</span>}
                      <span className={`text-[10px] ${msg.status === 'read' || msg.isRead ? 'text-neutral-400' : 'text-blue-500'}`}>
                        {msg.status === 'read' || msg.isRead ? '已读' : msg.status === 'delivered' ? '未读' : msg.status === 'sent' ? '已发送' : '未读'}
                      </span>
                    </div>
                  )}

                    <div className="relative max-w-[80%]" onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}>
                      {msg.quotedMessageId && (
                        <div className={`mb-1 p-2 rounded-lg text-xs border-l-2 ${
                          msg.role === 'user' ? 'bg-black/5 border-black/20 text-neutral-600' : 'bg-neutral-100 border-neutral-300 text-neutral-500'
                        }`}>
                          {(() => {
                            const quoted = messages.find(m => m.id === msg.quotedMessageId);
                            if (!quoted) return '消息已删除';
                            return (
                              <>
                                <div className="font-bold mb-0.5">{quoted.role === 'user' ? userProfile.name : currentPersona?.name}</div>
                                <div className="truncate">{quoted.text.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim()}</div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.msgType === 'xhsPost' && msg.xhsPost ? (
                          <div 
                            className={`flex flex-col gap-2 rounded-xl p-3 w-64 shadow-sm ${msg.role === 'user' ? 'custom-bubble-user' : 'custom-bubble-ai'}`}
                            style={{
                              backgroundColor: msg.role === 'user' 
                                ? (theme.chatBubbleUserCss && theme.chatBubbleUserCss.toLowerCase().includes('background') ? undefined : (theme.userBubbleColor || '#95ec69')) 
                                : (theme.chatBubbleAiCss && theme.chatBubbleAiCss.toLowerCase().includes('background') ? undefined : (theme.aiBubbleColor || '#ffffff')),
                              backgroundImage: msg.role === 'user' && theme.chatBubbleUser ? `url(${theme.chatBubbleUser})` : (msg.role === 'model' && theme.chatBubbleAi ? `url(${theme.chatBubbleAi})` : undefined),
                              backgroundSize: '100% 100%',
                              color: msg.role === 'user' ? (theme.userTextColor || '#171717') : (theme.aiTextColor || '#171717'),
                              border: (msg.role === 'model' && !theme.aiBubbleColor && !theme.chatBubbleAi && !theme.chatBubbleAiCss) ? '1px solid #e5e5e5' : undefined,
                              ...(msg.role === 'user' ? parsedUserCss : parsedAiCss),
                            }}
                          >
                          <div className="text-[13px] text-neutral-600 mb-1 flex items-center gap-1">
                            <img src="https://p3-pc-sign.byteimg.com/tos-cn-i-uz8ut6080o/8316982956274768864~tplv-uz8ut6080o-image.png?x-expires=1710000000&x-signature=..." className="w-4 h-4 rounded-full" alt="xhs logo" />
                            {msg.role === 'user' ? '我分享了小红书帖子' : '分享了小红书帖子'}
                          </div>
                          <div className="flex flex-col bg-white rounded-lg overflow-hidden shadow-sm">
                            {msg.xhsPost.images && msg.xhsPost.images.length > 0 ? (
                              <img src={msg.xhsPost.images[0]} className="w-full aspect-[4/3] object-cover" />
                            ) : (
                              <div className="w-full aspect-[4/3] bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs">无图片</div>
                            )}
                            <div className="p-2">
                              <div className="text-[14px] font-medium text-neutral-900 line-clamp-2">{msg.xhsPost.title}</div>
                              <div className="flex items-center gap-1 mt-1">
                                <img src={msg.xhsPost.authorAvatar} className="w-4 h-4 rounded-full" />
                                <span className="text-[11px] text-neutral-500">{msg.xhsPost.authorName}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : msg.msgType === 'taobaoProduct' && msg.taobaoProduct ? (
                        <div 
                          className={`flex flex-col gap-2 rounded-xl p-3 w-64 shadow-sm ${msg.role === 'user' ? 'custom-bubble-user' : 'custom-bubble-ai'}`}
                          style={{
                            backgroundColor: msg.role === 'user' 
                              ? (theme.chatBubbleUserCss && theme.chatBubbleUserCss.toLowerCase().includes('background') ? undefined : (theme.userBubbleColor || '#95ec69')) 
                              : (theme.chatBubbleAiCss && theme.chatBubbleAiCss.toLowerCase().includes('background') ? undefined : (theme.aiBubbleColor || '#ffffff')),
                            backgroundImage: msg.role === 'user' && theme.chatBubbleUser ? `url(${theme.chatBubbleUser})` : (msg.role === 'model' && theme.chatBubbleAi ? `url(${theme.chatBubbleAi})` : undefined),
                            backgroundSize: '100% 100%',
                            color: msg.role === 'user' ? (theme.userTextColor || '#171717') : (theme.aiTextColor || '#171717'),
                            border: (msg.role === 'model' && !theme.aiBubbleColor && !theme.chatBubbleAi && !theme.chatBubbleAiCss) ? '1px solid #e5e5e5' : undefined,
                            ...(msg.role === 'user' ? parsedUserCss : parsedAiCss),
                          }}
                        >
                          <div className="text-[13px] text-neutral-600 mb-1 flex items-center gap-1">
                            <img src="https://gw.alicdn.com/tfs/TB1O4sJQpXXXXbZXpXXXXXXXXXX-114-114.png" className="w-4 h-4 rounded-full" alt="taobao logo" />
                            {msg.role === 'user' ? '我分享了商品' : '分享了商品'}
                          </div>
                          <div className="flex bg-white rounded-lg overflow-hidden shadow-sm p-2 gap-2">
                            <img src={msg.taobaoProduct.image} className="w-16 h-16 rounded-md object-cover shrink-0" />
                            <div className="flex flex-col justify-between flex-1 min-w-0">
                              <div className="text-[14px] font-medium text-neutral-900 line-clamp-2 leading-tight">{msg.taobaoProduct.name}</div>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[#ff5000] text-xs">¥</span>
                                  <span className="text-[#ff5000] text-sm font-bold">{msg.taobaoProduct.price}</span>
                                </div>
                                {msg.taobaoProduct.sales && <span className="text-[10px] text-neutral-400">已售{msg.taobaoProduct.sales}</span>}
                              </div>
                              {msg.taobaoProduct.shop && <div className="text-[10px] text-neutral-400 truncate">{msg.taobaoProduct.shop}</div>}
                            </div>
                          </div>
                        </div>
                      ) : msg.msgType === 'music' && msg.song ? (
                        <div 
                          className={`flex flex-col gap-2 rounded-xl p-3 w-64 shadow-sm ${msg.role === 'user' ? 'custom-bubble-user' : 'custom-bubble-ai'}`}
                          style={{
                            backgroundColor: msg.role === 'user' 
                              ? (theme.chatBubbleUserCss && theme.chatBubbleUserCss.toLowerCase().includes('background') ? undefined : (theme.userBubbleColor || '#95ec69')) 
                              : (theme.chatBubbleAiCss && theme.chatBubbleAiCss.toLowerCase().includes('background') ? undefined : (theme.aiBubbleColor || '#ffffff')),
                            backgroundImage: msg.role === 'user' && theme.chatBubbleUser ? `url(${theme.chatBubbleUser})` : (msg.role === 'model' && theme.chatBubbleAi ? `url(${theme.chatBubbleAi})` : undefined),
                            backgroundSize: '100% 100%',
                            color: msg.role === 'user' ? (theme.userTextColor || '#171717') : (theme.aiTextColor || '#171717'),
                            border: (msg.role === 'model' && !theme.aiBubbleColor && !theme.chatBubbleAi && !theme.chatBubbleAiCss) ? '1px solid #e5e5e5' : undefined,
                            ...(msg.role === 'user' ? parsedUserCss : parsedAiCss),
                          }}
                        >
                        <div className="text-[13px] text-neutral-600 mb-1">{msg.role === 'user' ? '我分享了歌曲' : '分享了歌曲'}</div>
                        <div className="flex items-center gap-3 bg-white/50 p-2 rounded-lg">
                          <img src={msg.song.cover} className="w-10 h-10 rounded-md object-cover" />
                          <div className="flex-1 overflow-hidden">
                            <div className="text-[14px] font-medium text-neutral-900 truncate">{msg.song.title}</div>
                            <div className="text-[12px] text-neutral-500 truncate">{msg.song.artist}</div>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Play size={12} className="text-neutral-600 ml-0.5" />
                          </div>
                        </div>
                      </div>
                      ) : msg.msgType === 'listenTogether' ? (
                        <div 
                          onClick={() => onNavigate('music', { personaId: currentPersona?.id })}
                          className={`flex flex-col gap-2 rounded-xl p-3 w-64 shadow-sm cursor-pointer active:opacity-90 ${msg.role === 'user' ? 'custom-bubble-user' : 'custom-bubble-ai'}`}
                          style={{
                            backgroundColor: msg.role === 'user' 
                              ? (theme.userBubbleColor || (theme.chatBubbleUserCss && theme.chatBubbleUserCss.toLowerCase().includes('background') ? undefined : '#95ec69')) 
                              : (theme.aiBubbleColor || (theme.chatBubbleAiCss && theme.chatBubbleAiCss.toLowerCase().includes('background') ? undefined : '#ffffff')),
                            backgroundImage: msg.role === 'user' && theme.chatBubbleUser ? `url(${theme.chatBubbleUser})` : (msg.role === 'model' && theme.chatBubbleAi ? `url(${theme.chatBubbleAi})` : undefined),
                            backgroundSize: '100% 100%',
                            color: msg.role === 'user' ? (theme.userTextColor || '#171717') : (theme.aiTextColor || '#171717'),
                            border: (msg.role === 'model' && !theme.aiBubbleColor && !theme.chatBubbleAi && !theme.chatBubbleAiCss) ? '1px solid #e5e5e5' : undefined,
                            ...(msg.role === 'user' ? parsedUserCss : parsedAiCss),
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-white/20 rounded-full">
                              <Music size={16} className="text-white" />
                            </div>
                            <span className="text-[14px] font-medium">一起听歌</span>
                          </div>
                          <div className="text-[13px] opacity-90">
                            {msg.role === 'user' ? '我邀请你一起听歌' : '邀请你一起听歌'}
                          </div>
                          <div className="mt-1 pt-2 border-t border-white/20 flex items-center justify-between text-[12px]">
                            <span>点击加入音乐室</span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.text ? (
                            <div 
                              className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                                msg.role === 'user' 
                                  ? 'rounded-tr-sm custom-bubble-user' 
                                  : 'rounded-tl-sm custom-bubble-ai'
                              } ${msg.isInnerVoice ? 'custom-inner-voice' : ''}`}
                              style={msg.isInnerVoice ? {
                                backgroundColor: '#f5f5f5',
                                color: '#666666',
                                fontStyle: 'italic',
                                fontSize: '14px',
                                border: '1px dashed #cccccc',
                                ...(theme.innerVoiceCss ? {} : {}) // Allow custom CSS to override
                              } : {
                                backgroundColor: msg.role === 'user' 
                                  ? (theme.chatBubbleUserCss && theme.chatBubbleUserCss.toLowerCase().includes('background') ? undefined : (theme.userBubbleColor || '#95ec69')) 
                                  : (theme.chatBubbleAiCss && theme.chatBubbleAiCss.toLowerCase().includes('background') ? undefined : (theme.aiBubbleColor || '#ffffff')),
                                backgroundImage: msg.role === 'user' && theme.chatBubbleUser ? `url(${theme.chatBubbleUser})` : (msg.role === 'model' && theme.chatBubbleAi ? `url(${theme.chatBubbleAi})` : undefined),
                                backgroundSize: '100% 100%',
                                color: msg.role === 'user' ? (theme.userTextColor || '#171717') : (theme.aiTextColor || '#171717'),
                                border: (msg.role === 'model' && !theme.aiBubbleColor && !theme.chatBubbleAi && !theme.chatBubbleAiCss) ? '1px solid #e5e5e5' : undefined,
                                ...(msg.role === 'user' ? parsedUserCss : parsedAiCss),
                              }}
                            >
                              {(() => {
                                const cleanText = msg.text.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim();
                                const parts = cleanText.split(/(\[STICKER:\s*[^\]]+\])/g);

                                return (
                                  <div className="whitespace-pre-wrap break-words">
                                    {parts.map((part, i) => {
                                      const stickerMatch = part.match(/\[STICKER:\s*([^\]]+)\]/);
                                      if (stickerMatch) {
                                        const content = stickerMatch[1].trim();
                                        if (content === 'image') {
                                           return <span key={i} className="text-xs text-neutral-400 block my-1">[表情包图片]</span>;
                                        }

                                        let src = content;
                                        if (!content.startsWith('http') && !content.startsWith('data:')) {
                                           src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(content)}`;
                                        }

                                        return (
                                          <img 
                                            key={i} 
                                            src={src} 
                                            alt="sticker" 
                                            className="w-32 h-32 object-contain rounded-lg bg-neutral-100/50 my-1 block" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        );
                                      } else if (part) {
                                        return <span key={i}>{part}</span>;
                                      }
                                      return null;
                                    })}
                                  </div>
                                );
                              })()}
                              {msg.msgType === 'sticker' && msg.sticker && (
                                <div className="mt-2">
                                  <img 
                                    src={msg.sticker} 
                                    className="w-32 h-32 object-contain rounded-lg bg-neutral-100/50 min-h-[8rem] min-w-[8rem]" 
                                    alt="sticker" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.innerHTML = '<div class="w-32 h-32 bg-neutral-100/50 rounded-lg flex items-center justify-center text-neutral-400 text-xs">表情包加载失败</div>';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              {msg.msgType === 'sticker' && msg.sticker && (
                                <div className="my-1">
                                  <img 
                                    src={msg.sticker} 
                                    className="w-32 h-32 object-contain rounded-lg bg-neutral-100 min-h-[8rem] min-w-[8rem]" 
                                    alt="sticker" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.innerHTML = '<div class="w-32 h-32 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 text-xs">表情包加载失败</div>';
                                    }}
                                  />
                                </div>
                              )}
                              {msg.msgType === 'image' && msg.imageUrl && (
                                <div className="my-1">
                                  <img 
                                    src={msg.imageUrl} 
                                    className="max-w-[200px] max-h-[300px] object-cover rounded-lg bg-neutral-100" 
                                    alt="uploaded image" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </>
                          )}

                          {/* Inner Voice Display */}
                          {msg.role === 'model' && msg.showInnerVoice && msg.innerVoice && (
                            <div 
                              className="mt-1 flex items-start gap-1.5 px-2 max-w-[240px] cursor-pointer"
                              onClick={() => {
                                setMessages(prev => prev.map(m => 
                                  m.id === msg.id ? { ...m, showInnerVoice: false } : m
                                ));
                              }}
                            >
                              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: msg.innerVoiceMood ? 'transparent' : '#d8b4fe' }}>
                                {msg.innerVoiceMood ? (
                                  <span className="text-[18px] leading-none select-none filter drop-shadow-sm">{msg.innerVoiceMood}</span>
                                ) : (
                                  <div className="w-3 h-0.5 bg-purple-900 rounded-full translate-y-0.5 relative">
                                    <div className="absolute -top-1.5 -left-1 w-1 h-0.5 bg-purple-900 rounded-full rotate-12" />
                                    <div className="absolute -top-1.5 -right-1 w-1 h-0.5 bg-purple-900 rounded-full -rotate-12" />
                                  </div>
                                )}
                              </div>
                              <span 
                                className="text-[13px] leading-tight"
                                style={{ color: theme.innerVoiceTextColor || '#9333ea' }}
                              >
                                <span className="font-medium mr-1">{currentPersona?.name}的心声:</span>
                                {msg.innerVoice}
                              </span>
                            </div>
                          )}

                          {msg.msgType === 'transfer' && (() => {
                            return (
                            <div 
                              className={`flex items-center gap-3 rounded-xl p-3 w-64 bg-[#f39b3a] text-white shadow-sm ${msg.role === 'user' ? 'custom-bubble-user' : 'custom-bubble-ai'} cursor-pointer active:opacity-80 ${msg.transferStatus === 'accepted' || msg.transferStatus === 'rejected' ? 'opacity-70' : ''}`}
                              onClick={() => {
                                setSelectedTransferMsg(msg);
                              }}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/20`}>
                                <ArrowLeftRight size={20} className="text-white" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="text-[16px] font-medium">¥{msg.amount?.toFixed(2)}</div>
                                <div className="text-[12px] opacity-80 truncate">
                                  {msg.transferStatus === 'accepted' ? (msg.isRequest ? '已支付' : '已收款') :
                                   msg.transferStatus === 'rejected' ? (msg.isRequest ? '已拒绝' : '已退还') :
                                   msg.isRequest ? `收款请求${msg.transferNote ? ` - ${msg.transferNote}` : ''}` :
                                   msg.isRefund ? `退款${msg.transferNote ? ` - ${msg.transferNote}` : ''}` :
                                   msg.isReceived ? '已收款' :
                                   msg.transferNote ? msg.transferNote :
                                   (msg.role === 'user' ? '转账给对方' : '微信转账')}
                                </div>
                              </div>
                            </div>
                          )})()}

                          {msg.msgType === 'relativeCard' && (
                            <div className={`flex items-center gap-3 rounded-xl p-3 w-64 ${msg.role === 'user' ? 'bg-[#f39b3a] text-white custom-bubble-user' : 'bg-white border border-neutral-200 text-neutral-800 custom-bubble-ai'}`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-white/20' : 'bg-[#f39b3a]/10'}`}>
                                <CreditCard size={20} className={msg.role === 'user' ? 'text-white' : 'text-[#f39b3a]'} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="text-[16px] font-medium">亲属卡</div>
                                <div className="text-[12px] opacity-80 truncate">
                                  额度 ¥{msg.relativeCard?.limit}
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.msgType === 'checkPhoneRequest' && (
                            <div className={`flex flex-col gap-2 rounded-xl p-3 w-64 bg-white border border-neutral-200 text-neutral-800 shadow-sm custom-bubble-ai`}>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                  <Smartphone size={16} />
                                </div>
                                <div className="text-[14px] font-medium flex-1">请求查看手机</div>
                              </div>
                              <div className="text-[13px] text-neutral-600 mb-2">
                                {currentPersona?.name} 想要查看你的手机内容。
                              </div>
                              {msg.checkPhoneStatus === 'pending' ? (
                                <div className="flex gap-2 border-t border-neutral-100 pt-2">
                                  <button 
                                    onClick={() => handleCheckPhoneResponse(msg.id, false)}
                                    className="flex-1 py-1.5 bg-neutral-100 text-neutral-600 text-[13px] rounded-lg active:bg-neutral-200"
                                  >
                                    拒绝
                                  </button>
                                  <button 
                                    onClick={() => handleCheckPhoneResponse(msg.id, true)}
                                    className="flex-1 py-1.5 bg-blue-500 text-white text-[13px] rounded-lg active:bg-blue-600"
                                  >
                                    允许
                                  </button>
                                </div>
                              ) : (
                                <div className="text-[12px] text-neutral-400 border-t border-neutral-100 pt-2 text-center">
                                  {msg.checkPhoneStatus === 'accepted' ? '已允许' : '已拒绝'}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {msg.role === 'model' && (
                    <div className="flex flex-col items-start ml-2 justify-end pb-1 shrink-0">
                      {msg.timestamp && <span className="text-[10px] text-neutral-400 mb-0.5">{msg.timestamp}</span>}
                      <span className="text-[10px] text-neutral-400">已读</span>
                    </div>
                  )}

                  {msg.role === 'user' && (
                    <div className="relative ml-3 shrink-0 cursor-pointer active:scale-95 transition-transform" onDoubleClick={() => handlePat('user')}>
                      <div className="relative w-10 h-10 shrink-0">
                        <img 
                          src={userProfile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                          className="w-10 h-10 rounded-lg object-cover" 
                          alt="user avatar" 
                        />
                        {userProfile.avatarFrame && (
                          <img 
                            src={userProfile.avatarFrame} 
                            className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
                            alt="frame"
                            style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', transform: `translate(${userProfile.avatarFrameX || 0}px, ${userProfile.avatarFrameY || 0}px) scale(${userProfile.avatarFrameScale || 1})` }}
                          />
                        )}
                        {userProfile.avatarPendant && (
                          <img 
                            src={userProfile.avatarPendant} 
                            className="absolute -top-1 -right-1 w-5 h-5 object-contain pointer-events-none z-20 select-none"
                            alt="pendant"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )})}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div 
              className="bg-neutral-100 border-t border-neutral-200 shrink-0"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {currentPersona?.isBlocked ? (
                <div className="p-4 text-center text-neutral-400 text-sm">
                  对方已将你拉黑，无法发送消息
                </div>
              ) : (
                <>
                  {quotedMessage && (
                <div className="px-4 py-2 bg-neutral-200/50 flex items-center justify-between gap-2 border-b border-neutral-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-neutral-500 font-medium">引用 {quotedMessage.role === 'user' ? '自己' : currentPersona?.name} 的话：</div>
                    <div className="text-xs text-neutral-600 truncate">{quotedMessage.text.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim()}</div>
                  </div>
                  <button onClick={() => setQuotedMessage(null)} className="text-neutral-400 p-1">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="p-3 flex items-center gap-2">
                <input 
                  type="text" 
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && inputText.trim()) {
                      e.preventDefault();
                      handleSend(inputText);
                    }
                  }}
                  className="flex-1 bg-white rounded-md px-3 py-2 outline-none text-[15px] text-neutral-800"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {inputText.trim() ? (
                  <button 
                    onClick={() => handleSend(inputText)}
                    className="bg-[#07c160] text-white px-4 py-2 rounded-md font-medium text-[15px] active:bg-[#06ad56] transition-colors"
                  >
                    发送
                  </button>
                ) : (
                  <>
                    {currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'model' && (
                      <button 
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="w-9 h-9 rounded-full border border-neutral-400 flex items-center justify-center text-neutral-600 active:bg-neutral-200"
                      >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                      </button>
                    )}
                    <button 
                      onClick={() => { setShowPlusMenu(!showPlusMenu); setShowStickerMenu(false); }}
                      className="w-9 h-9 rounded-full border border-neutral-400 flex items-center justify-center text-neutral-600"
                    >
                      <Plus size={24} />
                    </button>
                    <button 
                      onClick={handleVoiceChat}
                      className="w-9 h-9 rounded-full border border-neutral-400 flex items-center justify-center text-neutral-600"
                    >
                      <Mic size={20} />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {showStickerMenu && !currentPersona?.isBlocked && (
            <div className="h-48 border-t border-neutral-200 bg-neutral-100 p-4 overflow-y-auto grid grid-cols-4 gap-4 z-50 relative">
              <div className="col-span-4 flex justify-end">
                <button 
                  onClick={() => setIsStickerManagementMode(!isStickerManagementMode)}
                  className={`text-[12px] px-2 py-1 rounded ${isStickerManagementMode ? 'bg-neutral-300' : 'bg-white'}`}
                >
                  {isStickerManagementMode ? '完成' : '管理'}
                </button>
              </div>
              {['happy', 'sad', 'angry', 'love', 'cry', 'laugh', 'cool', 'sleep'].map(seed => (
                <button 
                  key={seed}
                  onClick={() => handleSend('', 'sticker', undefined, undefined, undefined, `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`)}
                  className="flex items-center justify-center p-2 bg-white rounded-xl shadow-sm active:scale-95 transition-transform"
                >
                  <img src={`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`} alt={seed} className="w-12 h-12" referrerPolicy="no-referrer" />
                </button>
              ))}
              {userProfile.stickers?.map(sticker => (
                <div key={sticker.id} className="relative group">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Sticker button clicked. Management mode:', isStickerManagementMode);
                      if (!isStickerManagementMode) {
                        handleSend('', 'sticker', undefined, undefined, undefined, sticker.url);
                      }
                    }}
                    className="flex items-center justify-center p-2 bg-white rounded-xl shadow-sm active:scale-95 transition-transform w-full h-full relative z-0"
                  >
                    <img src={sticker.url} alt={sticker.name} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                  </button>
                  {isStickerManagementMode && (
                    <div className="absolute -top-1 -right-1 flex gap-1 z-50">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStickerToEdit(sticker);
                          setNewStickerName(sticker.name);
                        }}
                        className="bg-blue-500 text-white rounded-full p-1 text-[10px] shadow-md"
                      >
                        改
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStickerToDelete(sticker);
                        }}
                        className="bg-red-500 text-white rounded-full p-1 text-[10px] shadow-md"
                      >
                        删
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button 
                onClick={() => setShowAddStickerModal(true)}
                className="flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-sm active:scale-95 transition-transform border border-dashed border-neutral-300 text-neutral-400"
              >
                <Plus size={24} />
                <span className="text-[10px] mt-1">添加</span>
              </button>
            </div>
          )}
          {showPlusMenu && !currentPersona?.isBlocked && (
            <div className="border-t border-neutral-200 bg-neutral-100 p-6 grid grid-cols-4 gap-y-6 gap-x-4">
              <button 
                onClick={() => {
                  handleSend('一起听歌', 'listenTogether');
                }} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <Music size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">一起听歌</span>
              </button>
              
              <button 
                onClick={() => {
                  setShowPlusMenu(false);
                  fileInputRef.current?.click();
                }} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <Camera size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">发图片</span>
              </button>
              
              <button 
                onClick={() => {
                  setShowPlusMenu(false);
                  onNavigate('photoalbum');
                }} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <ImageIcon size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">相册</span>
              </button>
              
              <button 
                onClick={() => {
                  setShowPlusMenu(false);
                  const prompt = window.prompt("想要什么样的表情包？(例如：开心的猫咪)");
                  if (prompt) {
                    handleSend(`给我发一个表情包：${prompt}`);
                  }
                }} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <Smile size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">求表情包</span>
              </button>

              <button 
                onClick={() => {
                  setShowPlusMenu(false);
                  setShowStickerMenu(true);
                }} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <ImageIcon size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">表情面板</span>
              </button>

              <button onClick={() => handleStartCall('video')} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <Film size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">视频通话</span>
              </button>
              <button onClick={() => handleStartCall('voice')} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <Phone size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">语音通话</span>
              </button>
              <button onClick={handleTransferClick} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <ArrowLeftRight size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">转账</span>
              </button>
              <button onClick={() => setShowRelativeCardModal(true)} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-neutral-700 shadow-sm">
                  <CreditCard size={28} />
                </div>
                <span className="text-[12px] text-neutral-500">亲属卡</span>
              </button>
            </div>
          )}
        </div>

            {/* Edit Message Modal */}
            <AnimatePresence>
              {editingMessageId && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6"
                  onClick={() => setEditingMessageId(null)}
                >
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                      <span className="font-bold text-neutral-800">编辑消息</span>
                      <button onClick={() => setEditingMessageId(null)} className="text-neutral-400">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="p-4">
                      <textarea 
                        value={editInput}
                        onChange={e => setEditInput(e.target.value)}
                        className="w-full h-32 bg-neutral-50 rounded-xl p-3 text-[15px] outline-none border border-neutral-200 focus:border-[#07c160] transition-colors resize-none"
                        placeholder="输入修改内容..."
                        autoFocus
                      />
                    </div>
                    <div className="p-4 bg-neutral-50 flex gap-3">
                      <button 
                        onClick={() => setEditingMessageId(null)}
                        className="flex-1 py-2.5 rounded-xl font-medium text-neutral-500 active:bg-neutral-200 transition-colors"
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleSaveEdit}
                        className="flex-1 py-2.5 rounded-xl font-medium bg-[#07c160] text-white active:bg-[#06ad56] transition-colors shadow-sm"
                      >
                        保存
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Moments View */}
        {activeTab === 'moments' && (
          <div className="absolute inset-0 overflow-y-auto bg-white pb-[80px]">
            <div className="relative h-72 bg-neutral-200">
              <img src={theme.momentsBg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'} className="w-full h-full object-cover" alt="Moments Cover" />
              <div className="absolute -bottom-6 right-4 flex items-end gap-4">
                <span className="text-white font-bold text-xl drop-shadow-md mb-8">{userProfile.name || '我'}</span>
                <div className="w-20 h-20 rounded-xl bg-white p-0.5 shadow-sm relative">
                  <img src={userProfile.avatarUrl || defaultUserAvatar} className="w-full h-full rounded-lg object-cover" alt="Avatar" />
                  {userProfile.avatarFrame && (
                    <img 
                      src={userProfile.avatarFrame} 
                      className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
                      alt="frame"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', transform: `translate(${userProfile.avatarFrameX || 0}px, ${userProfile.avatarFrameY || 0}px) scale(${userProfile.avatarFrameScale || 1})` }}
                    />
                  )}
                  {userProfile.avatarPendant && (
                    <img 
                      src={userProfile.avatarPendant} 
                      className="absolute -top-1 -right-1 w-6 h-6 object-contain pointer-events-none z-20 select-none"
                      alt="pendant"
                    />
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-14 px-4 pb-4 space-y-8">
              {isAiProcessingMoment && (
                <div className="flex items-center justify-center py-4 text-neutral-500 text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> 朋友们正在看你的动态...
                </div>
              )}

              {moments.map(moment => {
                const isUser = moment.authorId === 'user';
                const authorPersona = personas.find(p => p.id === moment.authorId);
                const authorName = isUser ? (userProfile.name || '我') : (authorPersona?.name || 'AI');
                const authorAvatar = isUser ? (userProfile.avatarUrl || defaultUserAvatar) : (authorPersona?.avatarUrl || defaultAiAvatar);

                return (
                  <div key={moment.id} className="flex gap-3">
                    <div 
                      className="relative shrink-0 cursor-pointer active:opacity-70 transition-opacity"
                      onClick={() => {
                        if (!isUser && authorPersona) {
                          setCurrentChatId(authorPersona.id);
                          setActiveTab('chat');
                        }
                      }}
                    >
                      <img src={authorAvatar} className="w-10 h-10 rounded-lg object-cover" alt="Avatar" />
                      {(isUser ? userProfile.avatarFrame : authorPersona?.avatarFrame) && (
                        <img 
                          src={isUser ? userProfile.avatarFrame : authorPersona?.avatarFrame} 
                          className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
                          alt="frame"
                          style={{ 
                            filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', 
                            transform: `translate(${isUser ? (userProfile.avatarFrameX || 0) : (authorPersona?.avatarFrameX || 0)}px, ${isUser ? (userProfile.avatarFrameY || 0) : (authorPersona?.avatarFrameY || 0)}px) scale(${isUser ? (userProfile.avatarFrameScale || 1) : (authorPersona?.avatarFrameScale || 1)})` 
                          }}
                        />
                      )}
                      {(isUser ? userProfile.avatarPendant : authorPersona?.avatarPendant) && (
                        <img 
                          src={isUser ? userProfile.avatarPendant : authorPersona?.avatarPendant} 
                          className="absolute -top-1 -right-1 w-5 h-5 object-contain pointer-events-none z-20 select-none"
                          alt="pendant"
                        />
                      )}
                    </div>
                    <div className="flex-1 border-b border-neutral-100 pb-4">
                      <h3 
                        className="font-semibold text-[#576b95] text-[16px] cursor-pointer active:opacity-70 transition-opacity inline-block"
                        onClick={() => {
                          if (!isUser && authorPersona) {
                            setCurrentChatId(authorPersona.id);
                            setActiveTab('chat');
                          }
                        }}
                      >
                        {authorName}
                      </h3>
                      <p className="text-[15px] text-neutral-800 mt-1 leading-relaxed">{renderTextWithStickers(moment.text)}</p>
                      
                      {moment.imageUrl && (
                        <div className="mt-2">
                          <img src={moment.imageUrl} className="max-w-[80%] max-h-[300px] rounded-md object-cover" alt="Moment Image" />
                        </div>
                      )}
                      
                      {moment.xhsPost && (
                        <div className="mt-2 flex flex-col bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200 active:bg-neutral-200 cursor-pointer">
                          <div className="flex items-center gap-3 p-2">
                            {moment.xhsPost.images && moment.xhsPost.images.length > 0 ? (
                              <img src={moment.xhsPost.images[0]} className="w-12 h-12 rounded-md object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-neutral-200 flex items-center justify-center text-neutral-400 text-[10px]">无图</div>
                            )}
                            <div className="flex-1 overflow-hidden">
                              <div className="text-[14px] font-medium text-neutral-900 line-clamp-1">{moment.xhsPost.title}</div>
                              <div className="text-[12px] text-neutral-500 truncate">{moment.xhsPost.authorName}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {moment.song && (
                        <div className="mt-2 flex items-center gap-3 bg-neutral-100 p-2 rounded-lg active:bg-neutral-200 cursor-pointer">
                          <img src={moment.song.cover} className="w-10 h-10 rounded-md object-cover" />
                          <div className="flex-1 overflow-hidden">
                            <div className="text-[14px] font-medium text-neutral-900 truncate">{moment.song.title}</div>
                            <div className="text-[12px] text-neutral-500 truncate">{moment.song.artist}</div>
                          </div>
                          <div className="w-8 h-8 rounded-full border border-neutral-300 flex items-center justify-center mr-1">
                            <Play size={14} className="text-neutral-500 ml-0.5" />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 relative">
                        <div className="flex items-center gap-3">
                          <div className="text-[12px] text-neutral-400">{moment.createdAt ? formatRelativeTime(moment.createdAt) : moment.timestamp}</div>
                          <button 
                            onClick={() => handleDeleteMoment(moment.id)}
                            className="text-[12px] text-[#576b95] active:opacity-50"
                          >
                            删除
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleToggleLike(moment.id)}
                            className="bg-neutral-100 px-2 py-1 rounded flex items-center gap-1 text-neutral-500 active:bg-neutral-200 transition-colors"
                          >
                            <Heart size={14} className={(moment.likedByIds || []).includes('user') ? "fill-red-500 text-red-500" : ""} />
                          </button>
                          <button 
                            onClick={() => setCommentingMomentId(commentingMomentId === moment.id ? null : moment.id)}
                            className="bg-neutral-100 px-2 py-1 rounded flex items-center gap-1 text-neutral-500 active:bg-neutral-200"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Comments Section */}
                      {((moment.likedByIds || []).length > 0 || (moment.comments || []).length > 0) && (
                        <div className="mt-3 bg-neutral-100 rounded-md p-2.5 space-y-1.5">
                          {(moment.likedByIds || []).length > 0 && (
                            <div className="flex items-center gap-1.5 text-[13px] text-[#576b95] font-medium border-b border-neutral-200/50 pb-1.5 mb-1.5">
                              <Heart size={12} className="fill-current" /> 
                              {(moment.likedByIds || []).map(id => {
                                if (id === 'user') return userProfile.name || '我';
                                return personas.find(p => p.id === id)?.name || 'AI';
                              }).join(', ')}
                            </div>
                          )}
                           {(moment.comments || []).map(comment => {
                            const cIsUser = comment.authorId === 'user';
                            const cPersona = personas.find(p => p.id === comment.authorId);
                            const cName = cIsUser ? (userProfile.name || '我') : (cPersona?.name || 'AI');
                            
                            let replyName = '';
                            if (comment.replyToId) {
                              if (comment.replyToId === 'user') replyName = userProfile.name || '我';
                              else replyName = personas.find(p => p.id === comment.replyToId)?.name || 'AI';
                            }

                            return (
                              <div 
                                key={comment.id} 
                                className="text-[13px] leading-relaxed cursor-pointer active:bg-neutral-100 rounded px-1 -mx-1 transition-colors"
                                onClick={() => {
                                  setCommentingMomentId(moment.id);
                                  setReplyToId(comment.authorId);
                                  const targetName = cIsUser ? (userProfile.name || '我') : (cPersona?.name || 'AI');
                                  setCommentInput(`@${targetName} `);
                                }}
                              >
                                {replyName ? (
                                  <>
                                    <span className="font-medium text-[#576b95]">{cName}</span>
                                    <span className="text-neutral-800 mx-1">回复</span>
                                    <span className="font-medium text-[#576b95]">{replyName}</span>
                                    <span className="text-neutral-800">：{renderTextWithStickers(comment.text)}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-[#576b95]">{cName}</span>
                                    <span className="text-neutral-800">：{renderTextWithStickers(comment.text)}</span>
                                  </>
                                )}
                                {cIsUser && (
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteComment(moment.id, comment.id); }}
                                    className="ml-2 text-[11px] text-[#576b95] opacity-60 hover:opacity-100"
                                  >
                                    删除
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {aiReplyingMomentId === moment.id && (
                            <div className="text-[13px] text-neutral-500 flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" /> AI 正在回复...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Comment Input */}
                      {commentingMomentId === moment.id && (
                        <div className="mt-3 flex gap-2">
                          <input 
                            type="text" 
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(moment.id)}
                            placeholder="评论..."
                            className="flex-1 bg-neutral-100 border border-neutral-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-blue-400"
                            autoFocus
                          />
                          <button 
                            onClick={() => handleAddComment(moment.id)}
                            disabled={!commentInput.trim() || aiReplyingMomentId === moment.id}
                            className="bg-[#07c160] text-white px-3 py-1.5 rounded text-[13px] font-medium disabled:opacity-50"
                          >
                            发送
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Post Moment Modal */}
        {isPostingMoment && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-200">
              <button onClick={() => setIsPostingMoment(false)} className="text-neutral-800 text-[15px]">取消</button>
              <button 
                onClick={handlePostMoment}
                disabled={!newMomentText.trim()}
                className="bg-[#07c160] text-white px-4 py-1.5 rounded text-[14px] font-medium disabled:opacity-50"
              >
                发表
              </button>
            </div>
            <div className="p-4">
              <textarea 
                value={newMomentText}
                onChange={(e) => setNewMomentText(e.target.value)}
                placeholder="这一刻的想法..."
                className="w-full h-32 outline-none resize-none text-[15px] placeholder-neutral-400"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Relative Card Modal */}
      <AnimatePresence>
        {showRelativeCardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
            onClick={() => setShowRelativeCardModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full sm:w-[320px] bg-[#f2f2f2] rounded-t-[2rem] sm:rounded-2xl p-6 pb-10 sm:pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-2">
                  <img src={currentPersona?.avatarUrl || 'https://picsum.photos/seed/picsum/200/200'} className="w-10 h-10 rounded-lg" />
                  <span className="text-[15px] font-medium text-neutral-900">赠送给 {currentPersona?.name}</span>
                </div>
                
                <div className="w-full bg-white rounded-xl p-4">
                  <div className="text-[14px] text-neutral-900 mb-4">每月消费额度</div>
                  <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                    <span className="text-[24px] font-bold">¥</span>
                    <input 
                      type="number" 
                      value={relativeCardLimit}
                      onChange={(e) => setRelativeCardLimit(e.target.value)}
                      className="flex-1 text-[32px] font-bold outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="text-[12px] text-neutral-400 mt-2">优先使用亲属卡付款</div>
                </div>

                <button 
                  onClick={confirmRelativeCard}
                  className="w-full py-3.5 bg-[#07c160] text-white rounded-xl text-[16px] font-medium active:bg-[#06ad56] transition-colors"
                >
                  赠送
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Sticker Modal */}
      <AnimatePresence>
        {showAddStickerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
            onClick={() => setShowAddStickerModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full sm:w-[320px] bg-[#f2f2f2] rounded-t-[2rem] sm:rounded-2xl p-6 pb-10 sm:pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4">
                <div className="text-center font-medium text-[16px] mb-2">添加自定义表情</div>
                
                <div className="bg-white rounded-xl p-4 flex flex-col gap-4">
                  <div>
                    <div className="text-[13px] text-neutral-500 mb-1">表情名称 (供AI识别)</div>
                    <input 
                      type="text" 
                      value={newStickerName}
                      onChange={(e) => setNewStickerName(e.target.value)}
                      placeholder="例如: 大笑, 哭泣, 猫猫头"
                      className="w-full bg-neutral-100 rounded-lg px-3 py-2 outline-none text-[15px]"
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-neutral-500 mb-1">图片来源</div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newStickerUrl}
                        onChange={(e) => setNewStickerUrl(e.target.value)}
                        placeholder="输入图片链接 (URL)"
                        className="flex-1 bg-neutral-100 rounded-lg px-3 py-2 outline-none text-[15px]"
                      />
                      <label className="flex items-center justify-center px-3 bg-neutral-100 rounded-lg cursor-pointer active:bg-neutral-200 transition-colors">
                        <Camera size={20} className="text-neutral-500" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>
                  </div>
                  
                  {newStickerUrl && (
                    <div className="mt-2 flex flex-col items-center">
                      <div className="text-[12px] text-neutral-400 mb-2 w-full text-center">预览</div>
                      <img 
                        src={newStickerUrl} 
                        alt="Preview" 
                        className="w-16 h-16 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/100/100';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={() => setShowAddStickerModal(false)}
                    className="flex-1 py-3 bg-neutral-200 text-neutral-700 rounded-xl text-[15px] font-medium active:bg-neutral-300 transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleAddSticker}
                    disabled={!newStickerName.trim() || !newStickerUrl.trim()}
                    className="flex-1 py-3 bg-[#07c160] text-white rounded-xl text-[15px] font-medium active:bg-[#06ad56] transition-colors disabled:opacity-50 disabled:active:bg-[#07c160]"
                  >
                    添加
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticker Modals */}
        {stickerToEdit && (
          <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-6" onClick={() => setStickerToEdit(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-[16px] font-medium mb-4">修改表情名称</h3>
              <input 
                type="text" 
                value={newStickerName}
                onChange={(e) => setNewStickerName(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg p-2 mb-4 outline-none"
                placeholder="请输入新名称"
              />
              <div className="flex gap-3">
                <button onClick={() => setStickerToEdit(null)} className="flex-1 py-2 bg-neutral-200 rounded-lg">取消</button>
                <button 
                  onClick={() => {
                    if (newStickerName.trim()) {
                      setUserProfile(prev => ({
                        ...prev,
                        stickers: prev.stickers?.map(s => (s.id && stickerToEdit.id ? s.id === stickerToEdit.id : s.url === stickerToEdit.url) ? { ...s, name: newStickerName.trim() } : s)
                      }));
                      setStickerToEdit(null);
                    }
                  }}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
        {stickerToDelete && (
          <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-6" onClick={() => setStickerToDelete(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-[16px] font-medium mb-4">确定删除表情 "{stickerToDelete.name}" 吗？</h3>
              <div className="flex gap-3">
                <button onClick={() => setStickerToDelete(null)} className="flex-1 py-2 bg-neutral-200 rounded-lg">取消</button>
                <button 
                  onClick={() => {
                    setUserProfile(prev => ({
                      ...prev,
                      stickers: prev.stickers?.filter(s => s.id && stickerToDelete.id ? s.id !== stickerToDelete.id : s.url !== stickerToDelete.url)
                    }));
                    setStickerToDelete(null);
                  }}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Transfer Modal */}
        {showTransferModal && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
              <div className="bg-[#f39b3a] p-6 flex flex-col items-center justify-center text-white relative">
                <button onClick={() => setShowTransferModal(false)} className="absolute top-4 left-4 text-white/80 active:text-white">
                  <ChevronLeft size={24} />
                </button>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <ArrowLeftRight size={24} className="text-white" />
                </div>
                <h3 className="text-[16px] font-medium">微转账给 {currentPersona?.name}</h3>
              </div>
              <div className="p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] text-neutral-500 font-medium">转账金额</label>
                  <div className="flex items-center border-b border-neutral-200 pb-2">
                    <span className="text-3xl font-medium mr-2">¥</span>
                    <input 
                      type="number" 
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="flex-1 text-4xl font-medium outline-none bg-transparent"
                      autoFocus
                    />
                  </div>
                  <div className="text-[12px] text-neutral-500 flex justify-between">
                    <span>当前零钱余额 ¥{(userProfile.balance || 0).toFixed(2)}</span>
                    {(userProfile.balance || 0) < Number(transferAmount) && (
                      <span className="text-red-500">余额不足</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] text-neutral-500 font-medium">添加备注 (选填)</label>
                  <input 
                    type="text" 
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="20字以内"
                    maxLength={20}
                    className="w-full border-b border-neutral-200 pb-2 outline-none text-[16px]"
                  />
                </div>

                <button 
                  onClick={confirmTransfer}
                  disabled={!transferAmount || isNaN(Number(transferAmount))}
                  className="w-full py-3.5 bg-[#07c160] text-white rounded-xl text-[16px] font-medium active:bg-[#06ad56] disabled:opacity-50 transition-colors mt-2"
                >
                  转账
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Friend Modal */}
        {showAddFriend && (
          <div className="absolute inset-0 bg-neutral-100 z-50 flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 bg-white border-b border-neutral-200">
              <button onClick={() => setShowAddFriend(false)} className="text-neutral-800 text-[15px]">取消</button>
              <h2 className="font-semibold text-[16px]">添加好友 (新角色)</h2>
              <button 
                onClick={handleAddFriend}
                disabled={!newFriendName.trim()}
                className="bg-[#07c160] text-white px-4 py-1.5 rounded text-[14px] font-medium disabled:opacity-50"
              >
                添加
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 space-y-4">
                <div className="space-y-1">
                  <label className="text-[12px] text-neutral-500">好友昵称</label>
                  <input 
                    type="text" 
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    placeholder="输入好友名字"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-[#07c160] text-[15px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-neutral-500">人设提示词 (System Prompt)</label>
                  <textarea 
                    value={newFriendPrompt}
                    onChange={(e) => setNewFriendPrompt(e.target.value)}
                    placeholder="描述这个好友的性格、说话方式等..."
                    className="w-full h-32 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-[#07c160] resize-none text-[15px]"
                  />
                </div>
                <p className="text-[11px] text-neutral-400">添加后，可以在“世界书”中修改TA的头像和详细设定。</p>
              </div>
            </div>
          </div>
        )}

        {/* Persona Settings Modal */}
        {showPersonaSettings && (
          <div className="absolute inset-0 bg-neutral-100 z-50 flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 bg-white border-b border-neutral-200">
              <button onClick={() => setShowPersonaSettings(false)} className="text-neutral-800 text-[15px]">取消</button>
              <h2 className="font-semibold text-[16px]">我的人设 (针对当前好友)</h2>
              <button 
                onClick={handleSavePersonaSettings}
                className="bg-[#07c160] text-white px-4 py-1.5 rounded text-[14px] font-medium"
              >
                保存
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[12px] text-neutral-500">在这个对话中，我是...</label>
                    <button 
                      onClick={() => setTempUserPersona(userProfile.persona || '')}
                      className="text-[12px] text-[#07c160] font-medium active:opacity-70"
                    >
                      填入全局人设
                    </button>
                  </div>
                  <textarea 
                    value={tempUserPersona}
                    onChange={(e) => setTempUserPersona(e.target.value)}
                    placeholder="描述你在这个对话中的身份、性格、与对方的关系等。如果不填写，将使用全局人设。"
                    className="w-full h-48 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-[#07c160] resize-none text-[15px]"
                  />
                </div>
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                  <p className="text-[12px] text-neutral-500 leading-relaxed">
                    <span className="font-medium text-neutral-800">提示：</span><br/>
                    这个设定只会在与 <strong>{currentPersona?.name}</strong> 的对话中生效。<br/>
                    如果留空，AI 将使用你在“世界书”中设置的全局人设。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Screen */}
        <AnimatePresence>
          {callState.isActive && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              className="absolute inset-0 z-[100] bg-neutral-900 flex flex-col items-center justify-between text-white overflow-hidden"
            >
              {/* Background for Video Call */}
              {callState.type === 'video' && (
                <div className="absolute inset-0 z-0">
                  <img 
                    src={currentPersona?.avatarUrl || defaultAiAvatar} 
                    className="w-full h-full object-cover blur-sm opacity-50" 
                    alt="Background" 
                  />
                  {callState.status === 'connected' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       {/* Simulate video stream with avatar for now, or a placeholder video */}
                       <img 
                        src={currentPersona?.avatarUrl || defaultAiAvatar} 
                        className="w-full h-full object-cover" 
                        alt="Remote Video" 
                      />
                    </div>
                  )}
                  {/* Self View */}
                  {callState.status === 'connected' && !callState.isCameraOff && (
                    <div className="absolute top-12 right-4 w-24 h-32 bg-black rounded-lg overflow-hidden border border-white/20 shadow-lg">
                       <img 
                        src={userProfile.avatarUrl || defaultUserAvatar} 
                        className="w-full h-full object-cover" 
                        alt="Self Video" 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Background for Voice Call */}
              {callState.type === 'voice' && (
                <div className="absolute inset-0 z-0 bg-neutral-800">
                   <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/80"></div>
                </div>
              )}

              {/* Header Info */}
              <div className="relative z-10 pt-16 flex flex-col items-center w-full">
                {callState.type === 'voice' && (
                   <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-xl border-2 border-white/10">
                     <img src={currentPersona?.avatarUrl || defaultAiAvatar} className="w-full h-full object-cover" />
                   </div>
                )}
                <h2 className="text-2xl font-semibold mb-2">{currentPersona?.name}</h2>
                <p className="text-neutral-300 text-sm">
                  {callState.status === 'dialing' ? '正在等待对方接受邀请...' : formatCallDuration(callState.duration)}
                </p>
              </div>

              {/* Controls */}
              <div className="relative z-10 pb-12 w-full px-10">
                <div className="flex items-center justify-between">
                  {/* Mute Button */}
                  <button 
                    onClick={toggleMute}
                    className={`flex flex-col items-center gap-2 ${callState.isMuted ? 'text-white' : 'text-neutral-300'}`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${callState.isMuted ? 'bg-white text-black' : 'bg-white/10 backdrop-blur-md'}`}>
                      {callState.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </div>
                    <span className="text-xs">静音</span>
                  </button>

                  {/* Camera Button (Video Only) */}
                  {callState.type === 'video' && (
                    <button 
                      onClick={toggleCamera}
                      className={`flex flex-col items-center gap-2 ${callState.isCameraOff ? 'text-white' : 'text-neutral-300'}`}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${callState.isCameraOff ? 'bg-white text-black' : 'bg-white/10 backdrop-blur-md'}`}>
                        {callState.isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                      </div>
                      <span className="text-xs">摄像头</span>
                    </button>
                  )}

                  {/* Hang Up Button */}
                  <button 
                    onClick={handleEndCall}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                      <Phone size={32} className="rotate-[135deg]" />
                    </div>
                    <span className="text-xs">挂断</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Chat Overlay */}
        <AnimatePresence>
          {isVoiceChatActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[90] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white"
            >
              <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mb-8 animate-pulse">
                <Mic size={48} />
              </div>
              <p className="text-xl font-medium">正在聆听...</p>
              <button 
                onClick={handleVoiceChat}
                className="mt-8 px-6 py-2 bg-white/20 rounded-full text-sm"
              >
                结束语音对话
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'favorites' && (
          <div className="absolute inset-0 overflow-y-auto bg-neutral-100 pb-[80px]">
            {/* User Profile Header */}
            <div className="bg-white px-6 pt-12 pb-8 mb-3 flex items-center gap-4">
              <div className="relative shrink-0">
                <img 
                  src={userProfile.avatarUrl || defaultUserAvatar} 
                  className="w-16 h-16 rounded-xl object-cover" 
                  alt="avatar" 
                />
                {userProfile.avatarFrame && (
                  <img 
                    src={userProfile.avatarFrame} 
                    className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] object-contain pointer-events-none z-10 select-none"
                    alt="frame"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))', transform: `translate(${userProfile.avatarFrameX || 0}px, ${userProfile.avatarFrameY || 0}px) scale(${userProfile.avatarFrameScale || 1})` }}
                  />
                )}
                {userProfile.avatarPendant && (
                  <img 
                    src={userProfile.avatarPendant} 
                    className="absolute -top-2 -right-2 w-8 h-8 object-contain pointer-events-none z-20 select-none"
                    alt="pendant"
                  />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-neutral-900">{userProfile.name || '我'}</h2>
                <p className="text-sm text-neutral-500 mt-1">微信号: {userProfile.id || 'wxid_888888'}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center text-neutral-400">
                  <Compass size={14} />
                </div>
                <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
              </div>
            </div>

            <div className="space-y-3 px-0">
              {/* Avatar Frame Entry */}
              <div 
                onClick={() => {
                  setTempAvatarFrame(userProfile.avatarFrame || '');
                  setTempAvatarFrameScale(userProfile.avatarFrameScale || 1);
                  setTempAvatarFrameX(userProfile.avatarFrameX || 0);
                  setTempAvatarFrameY(userProfile.avatarFrameY || 0);
                  setTempAvatarPendant(userProfile.avatarPendant || '');
                  setShowAvatarFrameModal(true);
                }}
                className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center text-pink-500">
                    <Heart size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">自定义头像框</span>
                </div>
                <div className="flex items-center gap-2">
                  {userProfile.avatarFrame && (
                    <div className="w-6 h-6 rounded border border-neutral-100 overflow-hidden">
                      <img src={userProfile.avatarFrame} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
                </div>
              </div>

              {/* Auto-Reply Entry */}
              <div 
                onClick={() => setShowAutoReplyModal(true)}
                className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                    <RefreshCw size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">自动回复</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-neutral-400">{userProfile.autoReplyEnabled ? '开启' : '关闭'}</span>
                  <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
                </div>
              </div>

              {/* Wallet Section */}
              <div 
                onClick={() => setShowWallet(true)}
                className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#07c160]/10 rounded-lg flex items-center justify-center text-[#07c160]">
                    <Wallet size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">支付</span>
                </div>
                <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
              </div>

              <div className="h-2" />

              <div className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                    <Bookmark size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">收藏</span>
                </div>
                <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
              </div>

              <div className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-500">
                    <ImageIcon size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">朋友圈</span>
                </div>
                <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
              </div>

              <div className="h-2" />

              <div 
                onClick={() => onNavigate('api')}
                className="bg-white p-4 flex items-center justify-between active:bg-neutral-50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
                    <Settings size={18} />
                  </div>
                  <span className="text-[16px] text-neutral-800">设置</span>
                </div>
                <ChevronLeft size={20} className="text-neutral-300 rotate-180" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      {!currentChatId && (
        <div 
          className="bg-neutral-100 border-t border-neutral-200 flex justify-around items-center pt-2 shrink-0 z-10 relative"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 relative ${activeTab === 'chat' ? 'text-[#07c160]' : 'text-neutral-900'}`}>
            <MessageCircle size={24} className={activeTab === 'chat' ? 'fill-current' : ''} />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-neutral-100 z-10">
                {unreadCount}
              </div>
            )}
            <span className="text-[10px] font-medium">微信</span>
          </button>
          <button onClick={() => setActiveTab('contacts')} className={`flex flex-col items-center gap-1 ${activeTab === 'contacts' ? 'text-[#07c160]' : 'text-neutral-900'}`}>
            <Users size={24} className={activeTab === 'contacts' ? 'fill-current' : ''} />
            <span className="text-[10px] font-medium">通讯录</span>
          </button>
          <button onClick={() => setActiveTab('theater')} className={`flex flex-col items-center gap-1 ${activeTab === 'theater' ? 'text-[#07c160]' : 'text-neutral-900'}`}>
            <Film size={24} className={activeTab === 'theater' ? 'fill-current' : ''} />
            <span className="text-[10px] font-medium">剧场</span>
          </button>
          <button onClick={() => setActiveTab('moments')} className={`flex flex-col items-center gap-1 ${activeTab === 'moments' ? 'text-[#07c160]' : 'text-neutral-900'}`}>
            <Compass size={24} className={activeTab === 'moments' ? 'fill-current' : ''} />
            <span className="text-[10px] font-medium">发现</span>
          </button>
          <button onClick={() => setActiveTab('favorites')} className={`flex flex-col items-center gap-1 ${activeTab === 'favorites' ? 'text-[#07c160]' : 'text-neutral-900'}`}>
            <User size={24} className={activeTab === 'favorites' ? 'fill-current' : ''} />
            <span className="text-[10px] font-medium">我</span>
          </button>
        </div>
      )}
      {/* Theater Screen Overlay */}
      <AnimatePresence>
        {showTheater && currentPersona && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden"
          >
            {!activeTheaterScript ? (
              <div className="flex flex-col h-full bg-neutral-100">
                <div className="h-12 bg-neutral-100 border-b border-neutral-200 flex items-center px-4 shrink-0">
                  <button onClick={() => setShowTheater(false)} className="text-neutral-800 p-1 active:opacity-70">
                    <ChevronLeft size={24} />
                  </button>
                  <div className="flex-1 text-center pr-8">
                    <h1 className="font-semibold text-neutral-900 text-[16px]">剧场 - {currentPersona.name}</h1>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <Film size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-800">当前剧本</h3>
                        <p className="text-xs text-neutral-400">自由对话模式</p>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      当前正在进行自由对话。你可以通过下方的剧场列表选择特定的场景或剧本，开启全新的互动体验。
                    </p>
                  </div>

                  <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">推荐剧本</h2>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div 
                      onClick={() => setShowCreateScript(true)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 flex items-center gap-4 active:bg-neutral-50 cursor-pointer transition-colors border-dashed border-emerald-500/50"
                    >
                      <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0 text-emerald-500">
                        <Plus size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-neutral-800 truncate">自定义剧本</h3>
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">创造属于你的专属故事...</p>
                      </div>
                      <ChevronLeft size={16} className="text-neutral-300 rotate-180" />
                    </div>

                    {[
                      { title: '初次相遇', desc: '在雨后的咖啡馆，你们第一次擦肩而过...', icon: <Heart size={18} className="text-pink-500" /> },
                      { title: '深夜谈心', desc: '凌晨两点，TA突然给你发来一条消息...', icon: <Moon size={18} className="text-indigo-500" /> },
                      { title: '意外重逢', desc: '多年未见的前任，在异国的街头偶遇...', icon: <RefreshCw size={18} className="text-blue-500" /> },
                      { title: '秘密任务', desc: '你们是潜伏在敌方的搭档，今晚有重要行动...', icon: <Shield size={18} className="text-neutral-700" /> },
                      ...(userProfile.theaterScripts || []).map(s => ({ ...s, icon: <Film size={18} className="text-emerald-500" /> }))
                    ].map((script, i) => (
                      <div 
                        key={i}
                        onClick={() => {
                          setActiveTheaterScript(script);
                          
                          // Check if there are existing messages for this theater script
                          const hasHistory = messages.some(m => m.personaId === currentPersona.id && m.theaterId === script.title);
                          
                          if (!hasHistory) {
                            // Trigger AI to start the scenario with "Text Mode" instructions ONLY if no history
                            const startPrompt = `[系统指令：剧场模式（文字模式）开启。当前剧本是《${script.title}》。场景描述：${script.desc}。

请采用“文字模式”进行表演：
1. 包含丰富的动作描写、心理描写和环境描写。
2. 描写内容请放在括号 ( ) 或星号 * * 中，或者直接作为叙述文字。
3. 所有的对白内容必须包裹在双引号 “ ” 中。
4. 保持沉浸感，不要跳出人设。

请作为 ${currentPersona.name} 开启这个场景的第一句话。直接开始表演。]`;
                            handleSend(startPrompt, 'text', undefined, undefined, undefined, undefined, script.title);
                          }
                        }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 flex items-center gap-4 active:bg-neutral-50 cursor-pointer transition-colors"
                      >
                        <div className="w-12 h-12 bg-neutral-50 rounded-lg flex items-center justify-center shrink-0">
                          {script.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-neutral-800 truncate">{script.title}</h3>
                          <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{script.desc}</p>
                        </div>
                        <ChevronLeft size={16} className="text-neutral-300 rotate-180" />
                      </div>
                    ))}
                  </div>

                  <div className="bg-neutral-200/50 rounded-xl p-6 text-center border border-dashed border-neutral-300">
                    <p className="text-xs text-neutral-400">更多剧本正在创作中...</p>
                  </div>
                </div>

                {/* Create Script Modal */}
                <AnimatePresence>
                  {showCreateScript && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
                      >
                        <h3 className="text-lg font-bold text-neutral-900 mb-4">创建新剧本</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 block">剧本标题</label>
                            <input 
                              type="text" 
                              value={newScriptTitle}
                              onChange={(e) => setNewScriptTitle(e.target.value)}
                              placeholder="例如：末日求生"
                              className="w-full bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 outline-none focus:border-emerald-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 block">场景描述</label>
                            <textarea 
                              value={newScriptDesc}
                              onChange={(e) => setNewScriptDesc(e.target.value)}
                              placeholder="描述场景背景、你的身份以及与TA的关系..."
                              className="w-full bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 outline-none focus:border-emerald-500 transition-colors h-32 resize-none"
                            />
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button 
                              onClick={() => setShowCreateScript(false)}
                              className="flex-1 py-3 rounded-xl font-bold text-neutral-500 bg-neutral-100 active:scale-95 transition-transform"
                            >
                              取消
                            </button>
                            <button 
                              onClick={() => {
                                if (newScriptTitle && newScriptDesc) {
                                  const newScript = { title: newScriptTitle, desc: newScriptDesc };
                                  setUserProfile(prev => ({
                                    ...prev,
                                    theaterScripts: [...(prev.theaterScripts || []), newScript]
                                  }));
                                  setNewScriptTitle('');
                                  setNewScriptDesc('');
                                  setShowCreateScript(false);
                                  
                                  // Auto start
                                  setActiveTheaterScript(newScript);
                                  const startPrompt = `[系统指令：剧场模式（文字模式）开启。当前剧本是《${newScript.title}》。场景描述：${newScript.desc}。请开始你的表演。]`;
                                  handleSend(startPrompt, 'text', undefined, undefined, undefined, undefined, newScript.title);
                                }
                              }}
                              className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-500 shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
                              disabled={!newScriptTitle || !newScriptDesc}
                            >
                              开始
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div 
                className="flex-1 grid grid-rows-[auto_1fr_auto] relative bg-black overflow-hidden h-full"
                style={{ height: '100%' }}
              >
                {/* Cinematic Background */}
                <div className="absolute inset-0 z-0 bg-neutral-900 pointer-events-none">
                  <img 
                    src={currentPersona.avatarUrl || defaultAiAvatar} 
                    className="w-full h-full object-cover" 
                    style={{ opacity: theaterSettings.bgOpacity / 100 }}
                    alt="background"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/90" />
                </div>

                {/* Header */}
                <div className="pt-12 pb-4 flex items-center px-4 z-10 bg-gradient-to-b from-black/90 to-transparent">
                  <button onClick={() => setActiveTheaterScript(null)} className="text-white/80 p-2 hover:text-white transition-colors">
                    <ChevronLeft size={28} />
                  </button>
                  <div className="flex-1 text-center">
                    <h2 className="text-white font-medium tracking-widest text-lg">{activeTheaterScript.title}</h2>
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <p className="text-white/40 text-[10px] uppercase tracking-[0.2em]">Theater Mode</p>
                      <span className="w-1 h-1 bg-white/20 rounded-full" />
                      <p className="text-emerald-400/80 text-[10px] uppercase tracking-[0.1em] font-bold">文字模式</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={async () => {
                        try {
                          await localforage.setItem('messages', messages);
                          setShowSaveToast(true);
                          setTimeout(() => setShowSaveToast(false), 2000);
                        } catch (e) {
                          alert('保存失败');
                        }
                      }}
                      className="text-white/40 p-2 hover:text-white transition-colors relative"
                    >
                      <Bookmark size={20} />
                      <AnimatePresence>
                        {showSaveToast && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-full right-0 mt-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                          >
                            已保存
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                    <button 
                      onClick={() => setShowTheaterSettings(true)}
                      className="text-white/40 p-2 hover:text-white transition-colors"
                    >
                      <Sliders size={20} />
                    </button>
                    <button onClick={() => {
                      setShowTheater(false);
                      setActiveTheaterScript(null);
                    }} className="text-white/40 p-2 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Theater Settings Modal */}
                <AnimatePresence>
                  {showTheaterSettings && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-neutral-900 w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl"
                      >
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-white font-bold text-xl">剧场美化</h3>
                          <button onClick={() => setShowTheaterSettings(false)} className="text-white/40 p-2">
                            <X size={20} />
                          </button>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex justify-between text-xs text-white/40 uppercase tracking-widest">
                              <span>背景亮度</span>
                              <span>{theaterSettings.bgOpacity}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" 
                              value={theaterSettings.bgOpacity}
                              onChange={(e) => setTheaterSettings(prev => ({ ...prev, bgOpacity: parseInt(e.target.value) }))}
                              className="w-full accent-emerald-500"
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between text-xs text-white/40 uppercase tracking-widest">
                              <span>对白字号</span>
                              <span>{theaterSettings.dialogueSize}px</span>
                            </div>
                            <input 
                              type="range" min="14" max="24" 
                              value={theaterSettings.dialogueSize}
                              onChange={(e) => setTheaterSettings(prev => ({ ...prev, dialogueSize: parseInt(e.target.value) }))}
                              className="w-full accent-emerald-500"
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between text-xs text-white/40 uppercase tracking-widest">
                              <span>描写字号</span>
                              <span>{theaterSettings.descriptionSize}px</span>
                            </div>
                            <input 
                              type="range" min="12" max="20" 
                              value={theaterSettings.descriptionSize}
                              onChange={(e) => setTheaterSettings(prev => ({ ...prev, descriptionSize: parseInt(e.target.value) }))}
                              className="w-full accent-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => setTheaterSettings(prev => ({ ...prev, showBorder: !prev.showBorder }))}
                              className={`p-3 rounded-xl border transition-all text-sm ${theaterSettings.showBorder ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                            >
                              侧边装饰线
                            </button>
                            <button 
                              onClick={() => setTheaterSettings(prev => ({ ...prev, hideDelimiters: !prev.hideDelimiters }))}
                              className={`p-3 rounded-xl border transition-all text-sm ${theaterSettings.hideDelimiters ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                            >
                              隐藏符号
                            </button>
                            <button 
                              onClick={() => setTheaterSettings(prev => ({ ...prev, fontSerif: !prev.fontSerif }))}
                              className={`p-3 rounded-xl border transition-all text-sm ${theaterSettings.fontSerif ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                            >
                              衬线体对白
                            </button>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-white/10">
                            <div className="text-xs text-white/40 uppercase tracking-widest mb-2">角色名称设置</div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] text-white/30 mb-1 block">我的称呼</label>
                                <input 
                                  type="text" 
                                  value={theaterSettings.userRoleName}
                                  onChange={(e) => setTheaterSettings(prev => ({ ...prev, userRoleName: e.target.value }))}
                                  placeholder={userProfile.name}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-white/30 mb-1 block">TA的称呼</label>
                                <input 
                                  type="text" 
                                  value={theaterSettings.aiRoleName}
                                  onChange={(e) => setTheaterSettings(prev => ({ ...prev, aiRoleName: e.target.value }))}
                                  placeholder={currentPersona.name}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => setShowTheaterSettings(false)}
                          className="w-full mt-8 bg-white text-black font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                        >
                          完成设置
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Backtrack Button Overlay */}
                <div className="absolute top-28 right-4 z-20">
                  <button 
                    onClick={handleBacktrack}
                    className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all shadow-lg"
                    title="回溯"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>

                {/* Dialogue Area */}
                <div 
                  className="overflow-y-auto p-6 flex flex-col gap-10 z-10 scroll-smooth min-h-0"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {theaterMessages.map((msg, i) => (
                    <div 
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <motion.div 
                        initial={i === theaterMessages.length - 1 ? { opacity: 0, y: 10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[90%] ${msg.role === 'user' ? 'text-white/90 text-right italic' : ''}`}
                      >
                        {msg.text.split('\n').map((line, lineIdx) => {
                          if (!line.trim()) return <div key={lineIdx} className="h-2" />;
                          
                          // Split each line by delimiters
                          const parts = line.split(/(\(.*?\))|(\*.*?\*)|(\uff08.*?\uff09)/g);
                          
                          return (
                            <div key={lineIdx} className="mb-2">
                              {parts.map((part, partIdx) => {
                                if (!part) return null;
                                const isDescription = (part.startsWith('(') && part.endsWith(')')) || 
                                                      (part.startsWith('*') && part.endsWith('*')) ||
                                                      (part.startsWith('（') && part.endsWith('）'));
                                if (isDescription) {
                                  let displayText = part;
                                  if (theaterSettings.hideDelimiters) {
                                    displayText = part.replace(/^[\(\*\uff08]|[\)\*\uff09]$/g, '');
                                  }
                                  return (
                                    <span 
                                      key={partIdx} 
                                      className="text-white/40 italic font-sans block my-1 pl-4"
                                      style={{ 
                                        fontSize: `${theaterSettings.descriptionSize}px`,
                                        borderLeft: theaterSettings.showBorder ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                      }}
                                    >
                                      {displayText}
                                    </span>
                                  );
                                }
                                
                                // Handle dialogue - strip quotes if hideDelimiters is on
                                let dialogueText = part;
                                if (theaterSettings.hideDelimiters) {
                                  // Remove all standard quotes and Chinese quotes from the text
                                  dialogueText = part.replace(/["\u201c\u201d]/g, '');
                                  // Also remove leading/trailing asterisks or parentheses that might have been missed by the split regex
                                  // This handles cases where the AI forgets a closing delimiter or puts one at the start of a line
                                  dialogueText = dialogueText.replace(/[\*\(\)\uff08\uff09]/g, '');
                                }

                                return (
                                  <span 
                                    key={partIdx} 
                                    className={`text-white leading-relaxed ${theaterSettings.fontSerif ? 'font-serif' : 'font-sans'}`}
                                    style={{ fontSize: `${theaterSettings.dialogueSize}px` }}
                                  >
                                    {dialogueText}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </motion.div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} className="h-10 shrink-0" />
                </div>

                {/* Input Area */}
                <div className="p-6 pb-12 z-20 bg-black/90 backdrop-blur-xl border-t border-white/10 shrink-0">
                  {/* Typing Indicator Overlay (Inside Input Area for visibility) */}
                  <div className="relative flex items-center gap-3">
                    <input 
                      type="text"
                      ref={inputRef}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inputRef.current?.value.trim()) {
                          handleSend(inputRef.current.value, 'text', undefined, undefined, undefined, undefined, activeTheaterScript.title);
                          inputRef.current.value = '';
                        }
                      }}
                      placeholder="输入你的对白..."
                      className="flex-1 bg-white/20 border-2 border-white/30 rounded-full px-6 py-4 text-white placeholder:text-white/50 outline-none focus:border-white/70 transition-all text-[16px] shadow-inner"
                    />
                    <button 
                      onClick={() => {
                        if (inputRef.current?.value.trim()) {
                          handleSend(inputRef.current.value, 'text', undefined, undefined, undefined, undefined, activeTheaterScript.title);
                          inputRef.current.value = '';
                        }
                      }}
                      className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black active:scale-90 transition-transform shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                      <Plus className="rotate-45" size={28} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persona Moments View Overlay */}
      <AnimatePresence>
        {showPersonaMomentsId && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[110] flex flex-col"
          >
            <div className="h-12 flex items-center justify-between px-2 bg-white border-b border-neutral-200 shrink-0">
              <button onClick={() => setShowPersonaMomentsId(null)} className="p-2 text-neutral-800">
                <ChevronLeft size={24} />
              </button>
              <h1 className="font-semibold text-neutral-900 text-[16px]">
                {personas.find(p => p.id === showPersonaMomentsId)?.name} 的朋友圈
              </h1>
              <div className="w-10" />
            </div>
            
            <div className="flex-1 overflow-y-auto pb-12">
              <div className="relative h-64 bg-neutral-200">
                <img src={personas.find(p => p.id === showPersonaMomentsId)?.avatarUrl || defaultAiAvatar} className="w-full h-full object-cover blur-sm opacity-50" alt="Cover" />
                <div className="absolute -bottom-6 right-4 flex items-end gap-4">
                  <span className="text-white font-bold text-xl drop-shadow-md mb-8">{personas.find(p => p.id === showPersonaMomentsId)?.name}</span>
                  <div className="w-20 h-20 rounded-xl bg-white p-0.5 shadow-sm">
                    <img src={personas.find(p => p.id === showPersonaMomentsId)?.avatarUrl || defaultAiAvatar} className="w-full h-full rounded-lg object-cover" alt="Avatar" />
                  </div>
                </div>
              </div>

              <div className="pt-14 px-4 space-y-8">
                {moments.filter(m => m.authorId === showPersonaMomentsId).length > 0 ? (
                  moments.filter(m => m.authorId === showPersonaMomentsId).map(moment => (
                    <div key={moment.id} className="flex gap-3">
                      <div className="flex-1 border-b border-neutral-100 pb-4">
                        <p className="text-[15px] text-neutral-800 leading-relaxed">{renderTextWithStickers(moment.text)}</p>
                        {moment.imageUrl && (
                          <div className="mt-2">
                            <img src={moment.imageUrl} className="max-w-[80%] max-h-[300px] rounded-md object-cover" alt="Moment Image" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-[12px] text-neutral-400">{moment.createdAt ? formatRelativeTime(moment.createdAt) : moment.timestamp}</div>
                          <button 
                            onClick={() => handleDeleteMoment(moment.id)}
                            className="text-[12px] text-[#576b95] active:opacity-50"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-neutral-400 text-sm">暂无动态</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Screen Overlay */}
      <AnimatePresence>
        {showWallet && (
          <WalletScreen 
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onBack={() => setShowWallet(false)}
          />
        )}
      </AnimatePresence>

      {/* Auto-Reply Modal */}
      <AnimatePresence>
        {showAutoReplyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 z-[110] flex items-center justify-center p-6"
            onClick={() => setShowAutoReplyModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-bold text-neutral-900">自动回复设置</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={tempAutoReplyEnabled}
                      onChange={() => setTempAutoReplyEnabled(!tempAutoReplyEnabled)}
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#07c160]"></div>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] text-neutral-500 font-medium">回复内容</label>
                    <button 
                      onClick={handleAiDefineUserAutoReply}
                      className="text-[12px] text-blue-500 font-medium active:opacity-70"
                    >
                      让 AI 自定义
                    </button>
                  </div>
                  <textarea 
                    value={tempAutoReplyContent}
                    onChange={(e) => setTempAutoReplyContent(e.target.value)}
                    placeholder="请输入自动回复内容..."
                    className="w-full h-32 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-[#07c160] text-[15px] resize-none"
                  />
                  <p className="text-[11px] text-neutral-400">开启后，当 AI 主动发消息给你时，系统会自动发送此内容。</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowAutoReplyModal(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl text-[15px] font-medium active:bg-neutral-200 transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      setUserProfile(prev => ({
                        ...prev,
                        autoReplyEnabled: tempAutoReplyEnabled,
                        autoReplyContent: tempAutoReplyContent
                      }));
                      setShowAutoReplyModal(false);
                    }}
                    className="flex-1 py-3 bg-[#07c160] text-white rounded-xl text-[15px] font-medium active:bg-[#06ad56] transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAvatarFrameModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-neutral-900">头像美化 (框与挂件)</h3>
                <button onClick={() => setShowAvatarFrameModal(false)} className="text-neutral-400">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-center">
                  <div className="relative w-24 h-24">
                    <img 
                      src={userProfile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                      className="w-full h-full rounded-xl object-cover"
                      alt="Avatar"
                    />
                    {tempAvatarFrame && (
                      <img 
                        src={tempAvatarFrame} 
                        className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] object-contain pointer-events-none z-10"
                        alt="Frame"
                        style={{ transform: `translate(${tempAvatarFrameX}px, ${tempAvatarFrameY}px) scale(${tempAvatarFrameScale})` }}
                      />
                    )}
                    {tempAvatarPendant && (
                      <img 
                        src={tempAvatarPendant} 
                        className="absolute -top-2 -right-2 w-10 h-10 object-contain pointer-events-none z-20"
                        alt="Pendant"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">头像框链接 (Image URL)</label>
                    <input 
                      type="text" 
                      value={tempAvatarFrame}
                      onChange={(e) => setTempAvatarFrame(e.target.value)}
                      placeholder="输入图片链接..."
                      className="w-full px-4 py-3 bg-neutral-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-neutral-700">头像框大小缩放</label>
                      <span className="text-xs text-neutral-500">{tempAvatarFrameScale.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.05"
                      value={tempAvatarFrameScale}
                      onChange={(e) => setTempAvatarFrameScale(parseFloat(e.target.value))}
                      className="w-full accent-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-neutral-700">水平偏移 (X)</label>
                        <span className="text-xs text-neutral-500">{tempAvatarFrameX}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-50" 
                        max="50" 
                        step="1"
                        value={tempAvatarFrameX}
                        onChange={(e) => setTempAvatarFrameX(parseInt(e.target.value))}
                        className="w-full accent-green-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-neutral-700">垂直偏移 (Y)</label>
                        <span className="text-xs text-neutral-500">{tempAvatarFrameY}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-50" 
                        max="50" 
                        step="1"
                        value={tempAvatarFrameY}
                        onChange={(e) => setTempAvatarFrameY(parseInt(e.target.value))}
                        className="w-full accent-green-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">挂件链接 (Pendant URL)</label>
                    <input 
                      type="text" 
                      value={tempAvatarPendant}
                      onChange={(e) => setTempAvatarPendant(e.target.value)}
                      placeholder="输入挂件图片链接..."
                      className="w-full px-4 py-3 bg-neutral-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-neutral-500">预设头像框</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['https://cdn-icons-png.flaticon.com/512/5968/5968260.png', 
                      'https://cdn-icons-png.flaticon.com/512/2583/2583166.png',
                      'https://cdn-icons-png.flaticon.com/512/4228/4228730.png',
                      ''].map((url, i) => (
                      <button 
                        key={i}
                        onClick={() => setTempAvatarFrame(url)}
                        className={`aspect-square rounded-lg border-2 ${tempAvatarFrame === url ? 'border-green-500 bg-green-50' : 'border-neutral-100'} flex items-center justify-center relative overflow-hidden`}
                      >
                        {url ? <img src={url} className="w-8 h-8 object-contain" /> : <Ban size={20} className="text-neutral-300" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-neutral-500">预设挂件</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['https://cdn-icons-png.flaticon.com/512/1041/1041883.png', 
                      'https://cdn-icons-png.flaticon.com/512/2913/2913445.png',
                      'https://cdn-icons-png.flaticon.com/512/2553/2553691.png',
                      ''].map((url, i) => (
                      <button 
                        key={i}
                        onClick={() => setTempAvatarPendant(url)}
                        className={`aspect-square rounded-lg border-2 ${tempAvatarPendant === url ? 'border-green-500 bg-green-50' : 'border-neutral-100'} flex items-center justify-center relative overflow-hidden`}
                      >
                        {url ? <img src={url} className="w-8 h-8 object-contain" /> : <Ban size={20} className="text-neutral-300" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setUserProfile(prev => ({ 
                      ...prev, 
                      avatarFrame: tempAvatarFrame, 
                      avatarFrameScale: tempAvatarFrameScale, 
                      avatarFrameX: tempAvatarFrameX,
                      avatarFrameY: tempAvatarFrameY,
                      avatarPendant: tempAvatarPendant 
                    }));
                    setShowAvatarFrameModal(false);
                  }}
                  className="w-full py-3 bg-green-500 text-white font-bold rounded-xl active:scale-[0.98] transition-transform"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {selectedTransferMsg && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTransferMsg(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-[#f39b3a] p-6 flex flex-col items-center text-white relative">
                <button 
                  onClick={() => setSelectedTransferMsg(null)}
                  className="absolute top-4 left-4 p-2 bg-white/20 rounded-full active:bg-white/30"
                >
                  <X size={20} />
                </button>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <ArrowLeftRight size={32} />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  {selectedTransferMsg.isRequest 
                    ? (selectedTransferMsg.role === 'model' ? `${currentPersona?.name || '对方'} 的收款请求` : `向 ${currentPersona?.name || '对方'} 发起收款`)
                    : selectedTransferMsg.isRefund
                    ? (selectedTransferMsg.role === 'model' ? `${currentPersona?.name || '对方'} 的退款` : `退款给 ${currentPersona?.name || '对方'}`)
                    : (selectedTransferMsg.role === 'model' ? `${currentPersona?.name || '对方'} 的转账` : `转账给 ${currentPersona?.name || '对方'}`)
                  }
                </h3>
                <div className="text-4xl font-bold mb-2">¥{selectedTransferMsg.amount?.toFixed(2)}</div>
                {selectedTransferMsg.transferNote && (
                  <div className="text-sm opacity-90">"{selectedTransferMsg.transferNote}"</div>
                )}
              </div>
              <div className="p-6 flex flex-col gap-3">
                {selectedTransferMsg.role === 'model' && !selectedTransferMsg.isRequest && !selectedTransferMsg.isRefund && !selectedTransferMsg.isReceived ? (
                  // AI sent a transfer to User
                  (selectedTransferMsg.transferStatus === 'accepted' || selectedTransferMsg.isReceived) ? (
                    <div className="w-full py-3 text-center text-neutral-500 font-medium">已收款</div>
                  ) : selectedTransferMsg.transferStatus === 'rejected' ? (
                    <div className="w-full py-3 text-center text-neutral-500 font-medium">已退还</div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // Accept transfer
                          const newTx: Transaction = {
                            id: Date.now().toString() + '-ai-accept',
                            type: 'red_packet',
                            amount: selectedTransferMsg.amount!,
                            description: `${currentPersona?.name || '对方'} 的转账`,
                            timestamp: Date.now()
                          };
                          setUserProfile(prev => ({
                            ...prev,
                            balance: (prev.balance || 0) + (selectedTransferMsg.amount || 0),
                            transactions: [newTx, ...(prev.transactions || [])]
                          }));
                          setMessages(prev => prev.map(m => m.id === selectedTransferMsg.id ? { ...m, transferStatus: 'accepted' } : m));
                          
                          // Send a system message or user message to acknowledge
                          const acceptMsg: Message = {
                            id: Date.now().toString(),
                            personaId: currentPersona?.id || '',
                            role: 'user',
                            text: "",
                            msgType: 'transfer',
                            amount: selectedTransferMsg.amount,
                            isReceived: true,
                            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            isRead: true,
                            createdAt: Date.now(),
                            theaterId: selectedTransferMsg.theaterId
                          };
                          setMessages(prev => [...prev, acceptMsg]);
                          
                          setSelectedTransferMsg(null);
                        }}
                        className="w-full py-3 bg-[#f39b3a] text-white font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        确认收款
                      </button>
                      <button
                        onClick={() => {
                          // Reject transfer
                          setMessages(prev => prev.map(m => m.id === selectedTransferMsg.id ? { ...m, transferStatus: 'rejected' } : m));
                          
                          const rejectMsg: Message = {
                            id: Date.now().toString(),
                            personaId: currentPersona?.id || '',
                            role: 'user',
                            text: "",
                            msgType: 'transfer',
                            amount: selectedTransferMsg.amount,
                            isRefund: true,
                            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            isRead: true,
                            createdAt: Date.now(),
                            theaterId: selectedTransferMsg.theaterId
                          };
                          setMessages(prev => [...prev, rejectMsg]);
                          
                          setSelectedTransferMsg(null);
                        }}
                        className="w-full py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        退还
                      </button>
                    </>
                  )
                ) : selectedTransferMsg.role === 'model' && selectedTransferMsg.isRequest ? (
                  // AI sent a request for money to User
                  (selectedTransferMsg.transferStatus === 'accepted') ? (
                    <div className="w-full py-3 text-center text-neutral-500 font-medium">已支付</div>
                  ) : selectedTransferMsg.transferStatus === 'rejected' ? (
                    <div className="w-full py-3 text-center text-neutral-500 font-medium">已拒绝</div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // Pay the request
                          if ((userProfile.balance || 0) < (selectedTransferMsg.amount || 0)) {
                            alert('余额不足，无法支付');
                            return;
                          }
                          
                          // Deduct balance
                          const newTx: Transaction = {
                            id: Date.now().toString() + '-pay-request',
                            type: 'red_packet',
                            amount: -(selectedTransferMsg.amount!),
                            description: `支付 ${currentPersona?.name || '对方'} 的收款请求`,
                            timestamp: Date.now()
                          };
                          setUserProfile(prev => ({
                            ...prev,
                            balance: (prev.balance || 0) - (selectedTransferMsg.amount || 0),
                            transactions: [newTx, ...(prev.transactions || [])]
                          }));
                          
                          // Mark request as paid
                          setMessages(prev => prev.map(m => m.id === selectedTransferMsg.id ? { ...m, transferStatus: 'accepted' } : m));
                          
                          // Send a transfer message to AI
                          handleSend("", 'transfer', selectedTransferMsg.amount, "支付收款请求", undefined, undefined, selectedTransferMsg.theaterId);
                          
                          setSelectedTransferMsg(null);
                        }}
                        className="w-full py-3 bg-[#f39b3a] text-white font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        支付 ¥{selectedTransferMsg.amount?.toFixed(2)}
                      </button>
                      <button
                        onClick={() => {
                          // Reject request
                          setMessages(prev => prev.map(m => m.id === selectedTransferMsg.id ? { ...m, transferStatus: 'rejected' } : m));
                          setSelectedTransferMsg(null);
                        }}
                        className="w-full py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        拒绝
                      </button>
                    </>
                  )
                ) : selectedTransferMsg.role === 'user' && !selectedTransferMsg.isRequest && !selectedTransferMsg.isRefund && !selectedTransferMsg.isReceived ? (
                  // User sent a transfer to AI
                  <div className="w-full py-3 text-center text-neutral-500 font-medium">
                    {selectedTransferMsg.transferStatus === 'accepted' ? '对方已收款' : selectedTransferMsg.transferStatus === 'rejected' ? '对方已退还' : '等待对方收款'}
                  </div>
                ) : (
                  <div className="w-full py-3 text-center text-neutral-500 font-medium">
                    {selectedTransferMsg.isRequest ? (selectedTransferMsg.transferStatus === 'accepted' ? '已支付' : selectedTransferMsg.transferStatus === 'rejected' ? '已拒绝' : '收款请求') : selectedTransferMsg.isRefund ? '退款' : selectedTransferMsg.isReceived ? '已收款' : '转账详情'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeMessageMenu && (() => {
          const msg = messages.find(m => m.id === activeMessageMenu);
          if (!msg) return null;
          // User can only recall their own messages within 2 minutes. AI messages cannot be recalled by user.
          const canRecall = msg.role === 'user' && !msg.isRecalled && (Date.now() - (msg.createdAt || Date.now()) < 120000);
          
          return (
            <div className="fixed inset-0 z-[200] flex flex-col justify-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveMessageMenu(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl border-t border-white/20"
              >
                <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6" />
                
                <div className="grid grid-cols-4 gap-4">
                  {msg.role === 'model' && !msg.isRead && (
                    <button 
                      onClick={() => {
                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
                        setActiveMessageMenu(null);
                      }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 active:scale-90 transition-transform">
                        <Shield size={24} />
                      </div>
                      <span className="text-[12px] text-neutral-600 font-medium">设为已读</span>
                    </button>
                  )}
                  
                  {canRecall && (
                    <button 
                      onClick={() => handleRecall(msg.id)}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 active:scale-90 transition-transform">
                        <RotateCcw size={24} />
                      </div>
                      <span className="text-[12px] text-neutral-600 font-medium">撤回</span>
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      setQuotedMessage(msg);
                      setActiveMessageMenu(null);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 active:scale-90 transition-transform">
                      <Bookmark size={24} />
                    </div>
                    <span className="text-[12px] text-neutral-600 font-medium">引用</span>
                  </button>

                  <button 
                    onClick={() => handleStartEdit(msg)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 active:scale-90 transition-transform">
                      <Settings size={24} />
                    </div>
                    <span className="text-[12px] text-neutral-600 font-medium">编辑</span>
                  </button>

                  <button 
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 active:scale-90 transition-transform">
                      <Trash2 size={24} />
                    </div>
                    <span className="text-[12px] text-neutral-600 font-medium">删除</span>
                  </button>
                </div>

                <button 
                  onClick={() => setActiveMessageMenu(null)}
                  className="w-full mt-8 py-4 bg-neutral-100 text-neutral-500 font-bold rounded-2xl active:scale-[0.98] transition-transform"
                >
                  取消
                </button>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
      {/* AI Phone Modal */}
      {showAiPhone && currentPersona && (
        <AiPhoneModal 
          persona={currentPersona} 
          onClose={() => setShowAiPhone(false)} 
          onUpdatePersona={(updates) => {
            setPersonas(prev => prev.map(p => p.id === currentPersona.id ? { ...p, ...updates } : p));
          }}
          allMessages={messages}
          userProfile={userProfile}
          apiSettings={apiSettings}
          worldbook={worldbook}
          onSendMessageAsAi={(text) => {
            const aiMsg: Message = {
              id: Date.now().toString(),
              personaId: currentPersona.id,
              role: 'model',
              text,
              msgType: 'text',
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
              createdAt: Date.now(),
              isRead: true
            };
            setMessages(prev => [...prev, aiMsg]);
          }}
        />
      )}
    </div>
  );
}
