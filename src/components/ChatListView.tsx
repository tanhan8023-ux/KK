import React from 'react';
import { Persona, Message, UserProfile } from '../types';

interface Props {
  personas: Persona[];
  messages: Message[];
  userProfile: UserProfile;
  setCurrentChatId: (id: string | null) => void;
  defaultAiAvatar: string;
  formatRelativeTime: (timestampMs: number | undefined) => string;
}

export const ChatListView = ({ personas, messages, userProfile, setCurrentChatId, defaultAiAvatar, formatRelativeTime }: Props) => {
  const Row: React.FC<{ index: number; style: React.CSSProperties }> = ({ index, style }) => {
    const p = personas[index];
    const filtered = messages.filter(m => m.personaId === p.id);
    const lastMsg = filtered.pop();
    return (
      <div 
        style={style}
        onClick={() => setCurrentChatId(p.id)}
        className="flex items-center gap-3 p-3 border-b border-neutral-100 active:bg-neutral-50 cursor-pointer"
      >
        <div className="relative shrink-0">
          <img src={p.avatarUrl || defaultAiAvatar} className="w-12 h-12 rounded-xl object-cover" alt="avatar" />
          {p.avatarFrame && (
            <img 
              src={p.avatarFrame} 
              className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none z-10 select-none"
              alt="frame"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))' }}
            />
          )}
          {p.avatarPendant && (
            <img 
              src={p.avatarPendant} 
              className="absolute -top-1 -right-1 w-6 h-6 object-contain pointer-events-none z-20 select-none"
              alt="pendant"
            />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="text-[16px] font-medium text-neutral-900">
                {p.name}
                {p.isBlocked && <span className="ml-2 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">已拉黑</span>}
              </h3>
              <span className="text-[12px] text-neutral-400">
                {lastMsg ? formatRelativeTime(lastMsg.createdAt) : ''}
              </span>
            </div>
            {p.statusMessage && <p className="text-[12px] text-blue-500 truncate">[{p.statusMessage}]</p>}
          </div>
          <p className="text-[13px] text-neutral-500 truncate mt-0.5">
            {lastMsg ? (
              lastMsg.msgType === 'transfer' ? '[转账]' : 
              lastMsg.msgType === 'music' ? '[音乐分享]' :
              lastMsg.msgType === 'xhsPost' ? '[小红书分享]' :
              lastMsg.msgType === 'listenTogether' ? '[一起听歌]' :
              lastMsg.text.replace(/\|\|NEXT:[^|]+\|\|/g, '').trim()
            ) : '暂无消息'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white">
      {personas.map((p, index) => (
        <Row key={p.id} index={index} style={{}} />
      ))}
    </div>
  );
};
