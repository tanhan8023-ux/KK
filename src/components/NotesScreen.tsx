import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit3,
  FileText,
  Clock,
  Check
} from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  color: string;
}

export const NotesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [notes, setNotes] = useState<Note[]>([
    { id: '1', title: '给宝贝的惊喜清单', content: '1. 买一束郁金香\n2. 预定那家好吃的日料\n3. 写一封手写信', timestamp: Date.now() - 86400000, color: 'bg-yellow-100' },
    { id: '2', title: '旅行计划', content: '下个月去大理看洱海，住那家网红民宿。', timestamp: Date.now() - 172800000, color: 'bg-blue-100' },
    { id: '3', title: '日常碎碎念', content: '今天的天气真好，心情也跟着变好了。', timestamp: Date.now() - 259200000, color: 'bg-pink-100' },
  ]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: '',
      content: '',
      timestamp: Date.now(),
      color: ['bg-yellow-100', 'bg-blue-100', 'bg-pink-100', 'bg-green-100', 'bg-purple-100'][Math.floor(Math.random() * 5)]
    };
    setCurrentNote(newNote);
    setIsEditing(true);
  };

  const handleSaveNote = () => {
    if (currentNote) {
      if (currentNote.title.trim() === '' && currentNote.content.trim() === '') {
        setIsEditing(false);
        setCurrentNote(null);
        return;
      }
      
      const exists = notes.find(n => n.id === currentNote.id);
      if (exists) {
        setNotes(notes.map(n => n.id === currentNote.id ? currentNote : n));
      } else {
        setNotes([currentNote, ...notes]);
      }
    }
    setIsEditing(false);
    setCurrentNote(null);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between">
              <button onClick={onBack} className="p-2 -ml-2 text-neutral-600 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-bold text-neutral-900">备忘录</h2>
              <button onClick={handleAddNote} className="p-2 -mr-2 text-yellow-600 active:scale-95 transition-transform">
                <Plus size={24} />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索备忘录" 
                  className="w-full bg-neutral-100 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4 scrollbar-hide">
              {filteredNotes.length > 0 ? (
                filteredNotes.map((note) => (
                  <motion.div 
                    layout
                    key={note.id}
                    className={`${note.color} rounded-2xl p-4 shadow-sm border border-black/5 relative group`}
                    onClick={() => {
                      setCurrentNote(note);
                      setIsEditing(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-neutral-900 truncate pr-8">
                        {note.title || '无标题'}
                      </h3>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-neutral-700 line-clamp-3 mb-3">
                      {note.content || '无内容'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
                      <Clock size={10} />
                      <span>{new Date(note.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p>没有找到备忘录</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="edit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full"
          >
            {/* Edit Header */}
            <div className="p-6 flex items-center justify-between">
              <button onClick={handleSaveNote} className="p-2 -ml-2 text-neutral-600 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              <div className="flex gap-2">
                <button onClick={handleSaveNote} className="p-2 bg-yellow-500 text-white rounded-full shadow-lg shadow-yellow-500/30 active:scale-95 transition-transform">
                  <Check size={20} />
                </button>
              </div>
            </div>

            {/* Edit Content */}
            <div className="flex-1 flex flex-col px-8 pb-8">
              <input 
                type="text" 
                placeholder="标题" 
                className="text-2xl font-bold text-neutral-900 mb-4 focus:outline-none"
                value={currentNote?.title || ''}
                onChange={(e) => setCurrentNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                autoFocus
              />
              <textarea 
                placeholder="开始输入..." 
                className="flex-1 text-lg text-neutral-700 leading-relaxed resize-none focus:outline-none"
                value={currentNote?.content || ''}
                onChange={(e) => setCurrentNote(prev => prev ? { ...prev, content: e.target.value } : null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
