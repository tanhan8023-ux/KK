import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users
} from 'lucide-react';

export const CalendarScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('zh-CN', { month: 'long' });
  
  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  // Add empty slots for previous month
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  
  // Add days of current month
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const events = [
    { id: 1, title: '和宝贝约会', time: '18:00', location: '外滩18号', type: 'love' },
    { id: 2, title: '纪念日晚餐', time: '19:30', location: '旋转餐厅', type: 'anniversary' },
    { id: 3, title: '看电影', time: '21:00', location: '万达影城', type: 'leisure' },
  ];

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-neutral-100">
        <button onClick={onBack} className="p-2 -ml-2 text-neutral-600 active:scale-95 transition-transform">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm text-neutral-500 font-medium">{year}年</span>
          <h2 className="text-xl font-bold text-neutral-900">{monthName}</h2>
        </div>
        <button className="p-2 -mr-2 text-blue-500 active:scale-95 transition-transform">
          <Plus size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-8">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            return (
              <div 
                key={index} 
                className={`aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                  day ? 'cursor-pointer hover:bg-neutral-50' : ''
                } ${isToday ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'text-neutral-700'}`}
              >
                {day}
                {day === 12 && !isToday && <div className="absolute mt-6 w-1 h-1 bg-blue-500 rounded-full"></div>}
                {day === 14 && !isToday && <div className="absolute mt-6 w-1 h-1 bg-pink-500 rounded-full"></div>}
              </div>
            );
          })}
        </div>

        {/* Events List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-neutral-900">今日日程</h3>
            <span className="text-xs text-neutral-400 font-medium">3个日程</span>
          </div>

          <div className="space-y-4">
            {events.map((event, index) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 group"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-bold text-neutral-900">{event.time}</span>
                  <div className={`w-1 flex-1 rounded-full ${
                    event.type === 'love' ? 'bg-pink-400' : 
                    event.type === 'anniversary' ? 'bg-purple-400' : 'bg-blue-400'
                  }`}></div>
                </div>
                <div className={`flex-1 p-4 rounded-2xl border transition-all ${
                  event.type === 'love' ? 'bg-pink-50 border-pink-100' : 
                  event.type === 'anniversary' ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'
                }`}>
                  <h4 className="font-bold text-neutral-900 mb-2">{event.title}</h4>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <Clock size={12} />
                      <span>{event.time} - 20:30</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <MapPin size={12} />
                      <span>{event.location}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
