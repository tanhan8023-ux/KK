import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Heart, MessageCircle, Share2, Plus, User, Home, Search, Bookmark, ArrowLeft, Camera, Image as ImageIcon, X, Send, Compass, ShoppingBag } from 'lucide-react';
import { XHSPost, Persona, UserProfile, ApiSettings, WorldbookSettings, Message } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { fetchAiResponse } from '../services/aiService';
import { GoogleGenAI } from '@google/genai';

interface Props {
  personas: Persona[];
  userProfile: UserProfile;
  posts: XHSPost[];
  setPosts: React.Dispatch<React.SetStateAction<XHSPost[]>>;
  followedAuthorIds: string[];
  setFollowedAuthorIds: React.Dispatch<React.SetStateAction<string[]>>;
  blockedAuthorIds: string[];
  setBlockedAuthorIds: React.Dispatch<React.SetStateAction<string[]>>;
  onShareToChat: (post: XHSPost, personaId: string) => void;
  onShareToMoments: (post: XHSPost) => void;
  privateChats: Record<string, { text: string, isMe: boolean, time: number }[]>;
  setPrivateChats: React.Dispatch<React.SetStateAction<Record<string, { text: string, isMe: boolean, time: number }[]>>>;
  apiSettings: ApiSettings;
  worldbook: WorldbookSettings;
  aiRef: React.MutableRefObject<GoogleGenAI | null>;
  onBack: () => void;
  messages: Message[];
}

const MARKET_ITEMS = [
  { id: 'm1', title: '纯手工编织小花包包', price: '¥128', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=400&q=80', author: '编织小能手', desc: '每一个都是纯手工编织，独一无二的小花设计，超级适合春天背！' },
  { id: 'm2', title: '复古胶片相机ccd', price: '¥399', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80', author: '时光杂货铺', desc: '成色很新，功能完好，出片自带复古滤镜，送电池和挂绳。' },
  { id: 'm3', title: '原创设计纯银戒指', price: '¥268', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80', author: 'SilverMoon', desc: 'S925纯银材质，不规则肌理设计，简约而不简单。' },
  { id: 'm4', title: '可爱毛绒挂件', price: '¥45', image: 'https://images.unsplash.com/photo-1535295972055-1c762f4483e5?auto=format&fit=crop&w=400&q=80', author: '软绵绵', desc: '超级软乎乎的手感，挂在包包上太可爱啦！' },
  { id: 'm5', title: '手绘明信片一套', price: '¥29', image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=400&q=80', author: '画画的北北', desc: '一套8张，每一张都是用心绘制的风景，希望能治愈你。' },
  { id: 'm6', title: ' vintage中古耳环', price: '¥158', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=400&q=80', author: 'OldTime', desc: '在此刻相遇即是缘分，孤品仅此一对，错过不再有。' },
];

export function XHSScreen({ 
  personas, 
  userProfile, 
  posts, 
  setPosts, 
  followedAuthorIds, 
  setFollowedAuthorIds, 
  blockedAuthorIds, 
  setBlockedAuthorIds, 
  onShareToChat,
  onShareToMoments,
  privateChats,
  setPrivateChats,
  apiSettings,
  worldbook,
  aiRef,
  onBack,
  messages
}: Props) {
  const [activeTab, setActiveTab] = useState<'square' | 'market' | 'messages' | 'me'>('square');
  const [squareTab, setSquareTab] = useState<'following' | 'discover' | 'nearby'>('discover');
  const [meSubTab, setMeSubTab] = useState<'posts' | 'bookmarks'>('posts');
  const [marketTab, setMarketTab] = useState<'recommend' | 'handmade' | 'vintage'>('recommend');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedMarketItemId, setSelectedMarketItemId] = useState<string | null>(null);
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null);
  const [activeChatAuthorId, setActiveChatAuthorId] = useState<string | null>(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [privateMessageText, setPrivateMessageText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingPost, setSharingPost] = useState<XHSPost | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPost = posts.find(p => p.id === selectedPostId);
  const viewingAuthorPost = posts.find(p => p.authorId === viewingAuthorId);
  const activeChatAuthor = posts.find(p => p.authorId === activeChatAuthorId);

  const handleSendPrivateMessage = async () => {
    if (!privateMessageText.trim() || !activeChatAuthorId) return;
    
    const newMessage = {
      text: privateMessageText,
      isMe: true,
      time: Date.now()
    };

    setPrivateChats(prev => ({
      ...prev,
      [activeChatAuthorId]: [...(prev[activeChatAuthorId] || []), newMessage]
    }));
    
    const currentText = privateMessageText;
    setPrivateMessageText('');

    // AI Response logic
    const persona = personas.find(p => p.id === activeChatAuthorId);
    if (persona) {
      setIsTyping(true);
      try {
        const xhsHistory = privateChats[activeChatAuthorId] || [];
        const wechatHistory = messages.filter(m => m.personaId === activeChatAuthorId).map(m => ({
          text: m.text,
          isMe: m.role === 'user',
          time: m.createdAt || 0
        }));
        
        // Merge and sort by time
        const fullHistory = [...xhsHistory, ...wechatHistory].sort((a, b) => a.time - b.time);
        
        const contextMessages = fullHistory.slice(-20).map(m => ({
          role: m.isMe ? 'user' : 'assistant',
          content: m.text
        }));

        const aiResponse = await fetchAiResponse(
          currentText, 
          contextMessages, 
          persona, 
          apiSettings, 
          worldbook, 
          userProfile, 
          aiRef
        );

        const cleanedResponse = aiResponse.responseText.replace(/\[ID:\s*[\d.]+\]/gi, '').trim();

        // Simulate typing delay
        const delay = Math.min(cleanedResponse.length * 100, 3000) + 1000;
        setTimeout(() => {
          const aiMsg = {
            text: cleanedResponse,
            isMe: false,
            time: Date.now()
          };
          setPrivateChats(prev => ({
            ...prev,
            [activeChatAuthorId]: [...(prev[activeChatAuthorId] || []), aiMsg]
          }));
          setIsTyping(false);
        }, delay);
      } catch (e) {
        console.error("XHS AI response error:", e);
        setIsTyping(false);
      }
    }
  };
  
  const isFollowed = (authorId: string) => followedAuthorIds.includes(authorId);
  const isBlocked = (authorId: string) => blockedAuthorIds.includes(authorId);

  const toggleFollow = (authorId: string) => {
    if (authorId === 'user') return;
    setFollowedAuthorIds(prev => 
      prev.includes(authorId) ? prev.filter(id => id !== authorId) : [...prev, authorId]
    );
  };

  const toggleBlock = (authorId: string) => {
    if (authorId === 'user') return;
    setBlockedAuthorIds(prev => {
      const isBlocked = prev.includes(authorId);
      if (isBlocked) {
        return prev.filter(id => id !== authorId);
      } else {
        // When blocking, also unfollow
        setFollowedAuthorIds(f => f.filter(id => id !== authorId));
        return [...prev, authorId];
      }
    });
    setViewingAuthorId(null);
    setSelectedPostId(null);
  };

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          isLiked: !post.isLiked
        };
      }
      return post;
    }));
  };

  const handleBookmark = (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isBookmarked: !post.isBookmarked
        };
      }
      return post;
    }));
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !selectedPostId) return;

    setPosts(prev => prev.map(post => {
      if (post.id === selectedPostId) {
        const newComment = {
          id: Date.now().toString(),
          authorName: userProfile.name,
          authorAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
          text: commentText,
          createdAt: Date.now()
        };
        return {
          ...post,
          comments: post.comments + 1,
          commentsList: [...(post.commentsList || []), newComment]
        };
      }
      return post;
    }));
    setCommentText('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setNewPostImages(prev => [...prev, event.target?.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    const newPost: XHSPost = {
      id: Date.now().toString(),
      authorId: 'user',
      authorName: userProfile.name,
      authorAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
      title: newPostTitle,
      content: newPostContent,
      images: newPostImages.length > 0 ? newPostImages : ['https://picsum.photos/seed/xhs/800/1000'],
      likes: 0,
      comments: 0,
      commentsList: [],
      createdAt: Date.now()
    };

    setPosts(prev => [newPost, ...prev]);
    setShowCreateModal(false);
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostImages([]);
  };

  const filteredPosts = activeTab === 'square' 
    ? posts.filter(p => {
        if (isBlocked(p.authorId)) return false;
        if (squareTab === 'following') return followedAuthorIds.includes(p.authorId);
        if (squareTab === 'nearby') return p.id.includes('2') || p.id.includes('4'); // Simulated nearby logic
        return true; // discover
      })
    : (meSubTab === 'posts' ? posts.filter(p => p.authorId === 'user') : posts.filter(p => p.isBookmarked));

  return (
    <div className="w-full h-full bg-white flex flex-col relative overflow-hidden pt-10">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 bg-white border-b border-neutral-100 shrink-0 z-10">
        <button onClick={onBack} className="text-neutral-600 active:opacity-70">
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex items-center gap-6">
          {activeTab === 'square' ? (
            <>
              <button 
                onClick={() => setSquareTab('following')}
                className={`text-[15px] transition-colors ${squareTab === 'following' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                关注
              </button>
              <button 
                onClick={() => setSquareTab('discover')}
                className={`text-[17px] transition-colors relative py-2 ${squareTab === 'discover' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                发现
                {squareTab === 'discover' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-red-500 rounded-full" />}
              </button>
              <button 
                onClick={() => setSquareTab('nearby')}
                className={`text-[15px] transition-colors ${squareTab === 'nearby' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                附近
              </button>
            </>
          ) : (
            <span className="font-bold text-neutral-900">{userProfile.name}</span>
          )}
        </div>

        <button className="text-neutral-600">
          {activeTab === 'square' ? <Search size={22} /> : <Share2 size={22} />}
        </button>
      </div>

      {/* Content */}
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, x: activeTab === 'me' ? 20 : (activeTab === 'square' ? -20 : 0) }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-y-auto bg-neutral-50 pb-20"
      >
        {activeTab === 'square' && (
          <div className="grid grid-cols-2 gap-1.5 p-1.5">
            {filteredPosts.map(post => (
              <motion.div 
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedPostId(post.id)}
                className="bg-white rounded-lg overflow-hidden shadow-sm flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                  {post.images.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white">
                      1/{post.images.length}
                    </div>
                  )}
                </div>
                <div className="p-2.5 flex flex-col gap-1.5">
                  <h3 className="text-[13px] font-semibold text-neutral-900 line-clamp-2 leading-tight">{post.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingAuthorId(post.authorId);
                      }}
                      className="flex items-center gap-1.5 active:opacity-70"
                    >
                      <img src={post.authorAvatar} className="w-4 h-4 rounded-full object-cover" alt="avatar" />
                      <span className="text-[10px] text-neutral-500 truncate max-w-[60px]">{post.authorName}</span>
                    </button>
                    <div className="flex items-center gap-0.5">
                      <Heart size={12} className={post.isLiked ? "fill-red-500 text-red-500" : "text-neutral-400"} />
                      <span className={`text-[10px] ${post.isLiked ? "text-red-500" : "text-neutral-400"}`}>{post.likes}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'market' && (
          <div className="flex flex-col h-full bg-neutral-50">
            {/* Market Header */}
            <div className="flex items-center gap-6 px-4 py-3 bg-white border-b border-neutral-100 shrink-0">
              <button 
                onClick={() => setMarketTab('recommend')}
                className={`text-[15px] transition-colors relative py-2 ${marketTab === 'recommend' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                推荐
                {marketTab === 'recommend' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-red-500 rounded-full" />}
              </button>
              <button 
                onClick={() => setMarketTab('handmade')}
                className={`text-[15px] transition-colors ${marketTab === 'handmade' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                手工
              </button>
              <button 
                onClick={() => setMarketTab('vintage')}
                className={`text-[15px] transition-colors ${marketTab === 'vintage' ? 'text-neutral-900 font-bold' : 'text-neutral-400 font-medium'}`}
              >
                中古
              </button>
            </div>

            {/* Market Content */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-2">
                {MARKET_ITEMS.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedMarketItemId(item.id)}
                    className="bg-white rounded-lg overflow-hidden shadow-sm flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="aspect-square relative overflow-hidden bg-neutral-100">
                      <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                    </div>
                    <div className="p-2.5 flex flex-col gap-1">
                      <h3 className="text-[13px] font-semibold text-neutral-900 line-clamp-2 leading-tight">{item.title}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-red-500 font-bold text-sm">{item.price}</span>
                        <span className="text-[10px] text-neutral-400">{item.author}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white h-full flex flex-col">
            <div className="p-4 border-b border-neutral-50">
              <h2 className="font-bold text-lg">消息</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(Object.entries(privateChats) as [string, { text: string, isMe: boolean, time: number }[]][]).map(([authorId, history]) => {
                const author = posts.find(p => p.authorId === authorId);
                if (!author) return null;
                const lastMsg = history[history.length - 1];
                if (!lastMsg) return null;
                return (
                  <button 
                    key={authorId}
                    onClick={() => setActiveChatAuthorId(authorId)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 active:bg-neutral-100 transition-colors border-b border-neutral-50"
                  >
                    <img src={author.authorAvatar} className="w-12 h-12 rounded-full object-cover" alt="avatar" />
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-neutral-900">{author.authorName}</span>
                        <span className="text-[10px] text-neutral-400">{new Date(lastMsg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-neutral-500 line-clamp-1 mt-0.5">{lastMsg.text}</p>
                    </div>
                  </button>
                );
              })}
              {Object.keys(privateChats).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-300">
                  <MessageCircle size={48} strokeWidth={1} />
                  <p className="text-sm mt-4">暂无私信消息</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'me' && (
          <>
            <div className="bg-white p-6 mb-2 flex flex-col items-center">
              <img 
                src={userProfile.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'} 
                className="w-20 h-20 rounded-full object-cover border-2 border-neutral-100 shadow-sm"
                alt="avatar"
              />
              <h2 className="mt-3 font-bold text-lg text-neutral-900">{userProfile.name}</h2>
              <p className="text-xs text-neutral-400 mt-1">小红书号：{userProfile.name.toLowerCase()}_xhs</p>
              
              <div className="flex gap-8 mt-6">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-neutral-900">
                    {posts.filter(p => p.authorId === 'user').reduce((acc, p) => acc + p.likes, 0)}
                  </span>
                  <span className="text-[11px] text-neutral-500">获赞与收藏</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-neutral-900">0</span>
                  <span className="text-[11px] text-neutral-500">粉丝</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-neutral-900">{followedAuthorIds.length}</span>
                  <span className="text-[11px] text-neutral-500">关注</span>
                </div>
              </div>

              <div className="flex w-full mt-8 border-t border-neutral-100">
                <button 
                  onClick={() => setMeSubTab('posts')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${meSubTab === 'posts' ? 'text-neutral-900' : 'text-neutral-400'}`}
                >
                  笔记
                  {meSubTab === 'posts' && <motion.div layoutId="meTab" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-500 rounded-full" />}
                </button>
                <button 
                  onClick={() => setMeSubTab('bookmarks')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${meSubTab === 'bookmarks' ? 'text-neutral-900' : 'text-neutral-400'}`}
                >
                  收藏
                  {meSubTab === 'bookmarks' && <motion.div layoutId="meTab" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-500 rounded-full" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1.5">
              {filteredPosts.map(post => (
                <motion.div 
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedPostId(post.id)}
                  className="bg-white rounded-lg overflow-hidden shadow-sm flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                  </div>
                  <div className="p-2.5 flex flex-col gap-1.5">
                    <h3 className="text-[13px] font-semibold text-neutral-900 line-clamp-2 leading-tight">{post.title}</h3>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {filteredPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="mt-4 text-sm">还没有帖子哦，快去发布吧</p>
          </div>
        )}
      </motion.div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-white border-t border-neutral-100 flex items-center justify-around px-4 z-20">
        <button 
          onClick={() => setActiveTab('square')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'square' ? 'text-neutral-900' : 'text-neutral-400'}`}
        >
          <Home size={24} />
          <span className="text-[10px]">首页</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('market')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'market' ? 'text-neutral-900' : 'text-neutral-400'}`}
        >
          <ShoppingBag size={24} />
          <span className="text-[10px]">市集</span>
        </button>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="w-10 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <Plus size={20} strokeWidth={3} />
        </button>

        <button 
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'messages' ? 'text-neutral-900' : 'text-neutral-400'}`}
        >
          <MessageCircle size={24} />
          <span className="text-[10px]">消息</span>
        </button>

        <button 
          onClick={() => setActiveTab('me')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'me' ? 'text-neutral-900' : 'text-neutral-400'}`}
        >
          <User size={24} />
          <span className="text-[10px]">我</span>
        </button>
      </div>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[110] bg-white flex flex-col"
          >
            <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-100 shrink-0">
              <button onClick={() => setSelectedPostId(null)} className="text-neutral-600">
                <ArrowLeft size={24} />
              </button>
              <button 
                onClick={() => setViewingAuthorId(selectedPost.authorId)}
                className="flex items-center gap-2 active:opacity-70"
              >
                <img src={selectedPost.authorAvatar} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
                <span className="font-semibold text-sm text-neutral-900">{selectedPost.authorName}</span>
              </button>
              <button 
                onClick={() => {
                  setSharingPost(selectedPost);
                  setShowShareModal(true);
                }}
                className="text-neutral-600"
              >
                <Share2 size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Image Carousel (Simplified) */}
              <div className="w-full aspect-[3/4] bg-neutral-100">
                <img src={selectedPost.images[0]} className="w-full h-full object-cover" alt="post" />
              </div>

              <div className="p-4 space-y-4">
                <h1 className="text-xl font-bold text-neutral-900 leading-tight">{selectedPost.title}</h1>
                <p className="text-[15px] text-neutral-800 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                <div className="text-[12px] text-neutral-400">编辑于 {new Date(selectedPost.createdAt).toLocaleDateString()}</div>
                
                <div className="border-t border-neutral-100 pt-4">
                  <h3 className="font-bold text-sm text-neutral-900 mb-4">共 {selectedPost.commentsList?.length || 0} 条评论</h3>
                  {selectedPost.commentsList && selectedPost.commentsList.length > 0 ? (
                    <div className="space-y-4 pb-10">
                      {selectedPost.commentsList.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <button 
                            onClick={() => {
                              // Find authorId from posts if possible, or just use a mock logic
                              const author = posts.find(p => p.authorName === comment.authorName);
                              if (author) setViewingAuthorId(author.authorId);
                            }}
                            className="shrink-0 active:opacity-70"
                          >
                            <img src={comment.authorAvatar} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <button 
                                onClick={() => {
                                  const author = posts.find(p => p.authorName === comment.authorName);
                                  if (author) setViewingAuthorId(author.authorId);
                                }}
                                className="text-[13px] font-semibold text-neutral-500 active:opacity-70"
                              >
                                {comment.authorName}
                              </button>
                              <span className="text-[10px] text-neutral-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[14px] text-neutral-800 mt-1">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-neutral-300">
                      <MessageCircle size={32} strokeWidth={1} />
                      <p className="text-xs mt-2">还没有人评论，快来抢沙发吧</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="h-[60px] border-t border-neutral-100 flex items-center px-4 gap-4 bg-white shrink-0">
              <div className="flex-1 h-9 bg-neutral-100 rounded-full flex items-center px-4 gap-2">
                <input 
                  type="text"
                  placeholder="说点什么..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  className="bg-transparent flex-1 text-sm focus:outline-none text-neutral-800"
                />
                {commentText.trim() && (
                  <button onClick={handleAddComment} className="text-red-500 font-bold text-sm">发送</button>
                )}
              </div>
              <button 
                onClick={() => handleLike(selectedPost.id)}
                className="flex flex-col items-center"
              >
                <Heart size={22} className={selectedPost.isLiked ? "fill-red-500 text-red-500" : "text-neutral-600"} />
                <span className="text-[10px] text-neutral-500">{selectedPost.likes}</span>
              </button>
              <button 
                onClick={() => handleBookmark(selectedPost.id)}
                className="flex flex-col items-center"
              >
                <Bookmark size={22} className={selectedPost.isBookmarked ? "fill-yellow-500 text-yellow-500" : "text-neutral-600"} />
                <span className="text-[10px] text-neutral-500">收藏</span>
              </button>
              <button className="flex flex-col items-center">
                <MessageCircle size={22} className="text-neutral-600" />
                <span className="text-[10px] text-neutral-500">{selectedPost.commentsList?.length || 0}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Market Item Detail Modal */}
      <AnimatePresence>
        {selectedMarketItemId && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[140] bg-white flex flex-col"
          >
            {(() => {
              const item = MARKET_ITEMS.find(i => i.id === selectedMarketItemId);
              if (!item) return null;
              return (
                <>
                  <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-100 shrink-0">
                    <button onClick={() => setSelectedMarketItemId(null)} className="text-neutral-600">
                      <ArrowLeft size={24} />
                    </button>
                    <span className="font-bold text-neutral-900">商品详情</span>
                    <button className="text-neutral-600">
                      <Share2 size={22} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="w-full aspect-square bg-neutral-100">
                      <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                    </div>

                    <div className="p-4 space-y-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-red-500">{item.price}</span>
                        <span className="text-xs text-neutral-400">想要 128</span>
                      </div>
                      <h1 className="text-lg font-bold text-neutral-900 leading-tight">{item.title}</h1>
                      <p className="text-sm text-neutral-600 leading-relaxed">{item.desc}</p>
                      
                      <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg mt-4">
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xs font-bold">
                          {item.author[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-neutral-900">{item.author}</div>
                          <div className="text-xs text-neutral-400">信用极好 | 2天内发货</div>
                        </div>
                        <button className="px-3 py-1.5 bg-white border border-neutral-200 rounded-full text-xs font-medium text-neutral-600">
                          进店
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-[60px] border-t border-neutral-100 flex items-center px-4 gap-4 bg-white shrink-0">
                    <button className="flex flex-col items-center gap-0.5 text-neutral-600">
                      <MessageCircle size={20} />
                      <span className="text-[10px]">留言</span>
                    </button>
                    <button className="flex flex-col items-center gap-0.5 text-neutral-600">
                      <Heart size={20} />
                      <span className="text-[10px]">收藏</span>
                    </button>
                    <button className="flex-1 h-10 bg-red-500 rounded-full text-white font-bold text-sm active:scale-95 transition-transform">
                      我想要
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share to WeChat Modal */}
      <AnimatePresence>
        {showShareModal && sharingPost && (
          <div className="absolute inset-0 z-[200] flex items-end justify-center bg-black/40">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-3xl p-6 pb-10 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-neutral-900">分享到</h3>
                <button onClick={() => setShowShareModal(false)} className="text-neutral-400">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex gap-6 overflow-x-auto pb-2 no-scrollbar">
                <button 
                  onClick={() => {
                    onShareToMoments(sharingPost);
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center gap-2 shrink-0 active:opacity-70"
                >
                  <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <Compass size={30} />
                  </div>
                  <span className="text-[11px] text-neutral-600">朋友圈</span>
                </button>

                <div className="w-[1px] h-14 bg-neutral-100 shrink-0" />

                {personas.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => {
                      onShareToChat(sharingPost, p.id);
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center gap-2 shrink-0 active:opacity-70"
                  >
                    <img src={p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt="avatar" />
                    <span className="text-[11px] text-neutral-600 truncate w-14 text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Author Profile Modal */}
      <AnimatePresence>
        {viewingAuthorId && viewingAuthorId !== 'user' && viewingAuthorPost && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[120] bg-white flex flex-col"
          >
            <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-100 shrink-0">
              <button onClick={() => setViewingAuthorId(null)} className="text-neutral-600">
                <X size={24} />
              </button>
              <span className="font-bold text-neutral-900">用户主页</span>
              <button 
                onClick={() => toggleBlock(viewingAuthorId)}
                className="text-neutral-400 text-sm font-medium"
              >
                拉黑
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 flex flex-col items-center border-b border-neutral-50">
                <img 
                  src={viewingAuthorPost.authorAvatar} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-neutral-50 shadow-sm"
                  alt="avatar"
                />
                <h2 className="mt-4 font-bold text-xl text-neutral-900">{viewingAuthorPost.authorName}</h2>
                <p className="text-xs text-neutral-400 mt-1">小红书号：{viewingAuthorPost.authorName.toLowerCase()}_xhs</p>
                
                <div className="flex gap-4 mt-6 w-full">
                  <button 
                    onClick={() => toggleFollow(viewingAuthorId)}
                    className={`flex-1 h-10 rounded-full font-bold text-sm transition-all ${
                      isFollowed(viewingAuthorId) 
                        ? 'bg-neutral-100 text-neutral-500' 
                        : 'bg-red-500 text-white shadow-md active:scale-95'
                    }`}
                  >
                    {isFollowed(viewingAuthorId) ? '已关注' : '关注'}
                  </button>
                  <button 
                    onClick={() => {
                      if (!privateChats[viewingAuthorId]) {
                        setPrivateChats(prev => ({ ...prev, [viewingAuthorId]: [] }));
                      }
                      setActiveChatAuthorId(viewingAuthorId);
                      setViewingAuthorId(null);
                      setActiveTab('messages');
                    }}
                    className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 active:bg-neutral-50"
                  >
                    <Send size={18} />
                  </button>
                </div>

                <div className="flex gap-10 mt-8">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-neutral-900">{viewingAuthorPost.likes + 120}</span>
                    <span className="text-[11px] text-neutral-500">获赞与收藏</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-neutral-900">8.2k</span>
                    <span className="text-[11px] text-neutral-500">粉丝</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-neutral-900">12</span>
                    <span className="text-[11px] text-neutral-500">关注</span>
                  </div>
                </div>
              </div>

              <div className="p-1.5 grid grid-cols-2 gap-1.5">
                {posts.filter(p => p.authorId === viewingAuthorId).map(post => (
                  <div key={post.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-neutral-50">
                    <img src={post.images[0]} className="w-full aspect-[3/4] object-cover" alt="post" />
                    <div className="p-2">
                      <h3 className="text-[12px] font-semibold text-neutral-800 line-clamp-1">{post.title}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Private Chat Modal */}
      <AnimatePresence>
        {activeChatAuthorId && activeChatAuthor && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[130] bg-white flex flex-col"
          >
            <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-100 shrink-0">
              <button onClick={() => setActiveChatAuthorId(null)} className="text-neutral-600">
                <ArrowLeft size={24} />
              </button>
              <span className="font-bold text-neutral-900">{activeChatAuthor.authorName}</span>
              <button className="text-neutral-600">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50">
              {(privateChats[activeChatAuthorId] || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                    msg.isMe ? 'bg-red-500 text-white rounded-tr-none' : 'bg-white text-neutral-800 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                    <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-100 bg-white flex items-center gap-2">
              <input 
                type="text"
                placeholder="发私信..."
                value={privateMessageText}
                onChange={(e) => setPrivateMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPrivateMessage()}
                className="flex-1 h-10 bg-neutral-100 rounded-full px-4 text-sm focus:outline-none"
              />
              <button 
                onClick={handleSendPrivateMessage}
                disabled={!privateMessageText.trim()}
                className="text-red-500 font-bold disabled:opacity-30"
              >
                发送
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] bg-white flex flex-col"
          >
            <div className="h-12 flex items-center justify-between px-4 border-b border-neutral-100">
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-600">
                <X size={24} />
              </button>
              <h2 className="font-bold text-neutral-900">发布笔记</h2>
              <button 
                onClick={handleCreatePost}
                disabled={!newPostTitle.trim() || !newPostContent.trim()}
                className="text-red-500 font-bold disabled:opacity-30"
              >
                发布
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {newPostImages.map((img, i) => (
                  <div key={i} className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-neutral-100">
                    <img src={img} className="w-full h-full object-cover" alt="preview" />
                    <button 
                      onClick={() => setNewPostImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 shrink-0 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 active:bg-neutral-100"
                >
                  <Camera size={24} />
                  <span className="text-[10px] mt-1">添加图片</span>
                </button>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload}
                />
              </div>

              <input 
                type="text"
                placeholder="填写标题会有更多赞哦"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                className="w-full text-lg font-bold placeholder:text-neutral-300 focus:outline-none border-b border-neutral-100 pb-2"
              />

              <textarea 
                placeholder="添加正文"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full h-40 resize-none placeholder:text-neutral-300 focus:outline-none text-[15px] leading-relaxed"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
