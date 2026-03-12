import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  Sun, 
  CloudSnow, 
  Wind, 
  Droplets, 
  Thermometer, 
  ChevronLeft,
  Search,
  MapPin,
  Calendar,
  Sunrise,
  Sunset
} from 'lucide-react';

interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  visibility: number;
  pressure: number;
  forecast: Array<{
    day: string;
    temp: number;
    condition: string;
  }>;
  hourly: Array<{
    time: string;
    temp: number;
    condition: string;
  }>;
}

export const WeatherScreen: React.FC<{ onBack: () => void; theme: any }> = ({ onBack, theme }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching weather data
    setTimeout(() => {
      setWeather({
        city: '上海',
        temp: 22,
        condition: '多云',
        high: 25,
        low: 18,
        humidity: 65,
        windSpeed: 12,
        uvIndex: 4,
        visibility: 10,
        pressure: 1012,
        forecast: [
          { day: '今天', temp: 22, condition: '多云' },
          { day: '周五', temp: 24, condition: '晴' },
          { day: '周六', temp: 21, condition: '阵雨' },
          { day: '周日', temp: 19, condition: '多云' },
          { day: '周一', temp: 23, condition: '晴' },
          { day: '周二', temp: 25, condition: '晴' },
          { day: '周三', temp: 22, condition: '多云' },
        ],
        hourly: [
          { time: '现在', temp: 22, condition: '多云' },
          { time: '14:00', temp: 23, condition: '多云' },
          { time: '15:00', temp: 24, condition: '晴' },
          { time: '16:00', temp: 24, condition: '晴' },
          { time: '17:00', temp: 23, condition: '晴' },
          { time: '18:00', temp: 21, condition: '多云' },
          { time: '19:00', temp: 20, condition: '多云' },
          { time: '20:00', temp: 19, condition: '多云' },
        ]
      });
      setLoading(false);
    }, 800);
  }, []);

  const getIcon = (condition: string, size = 24) => {
    switch (condition) {
      case '晴': return <Sun size={size} className="text-yellow-400" />;
      case '多云': return <Cloud size={size} className="text-gray-400" />;
      case '阵雨': return <CloudRain size={size} className="text-blue-400" />;
      case '雷阵雨': return <CloudLightning size={size} className="text-purple-400" />;
      case '雪': return <CloudSnow size={size} className="text-blue-200" />;
      default: return <Cloud size={size} className="text-gray-400" />;
    }
  };

  if (loading || !weather) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Cloud size={48} className="text-white animate-pulse" />
          <span className="text-white font-medium">正在获取天气...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-b from-blue-400 to-blue-600 overflow-hidden flex flex-col text-white">
      {/* Header */}
      <div className="p-6 flex items-center justify-between z-10">
        <button onClick={onBack} className="p-2 bg-white/20 backdrop-blur-md rounded-full active:scale-95 transition-transform">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-bold flex items-center gap-1">
            <MapPin size={16} />
            {weather.city}
          </h2>
          <span className="text-xs opacity-80">最后更新: 13:45</span>
        </div>
        <button className="p-2 bg-white/20 backdrop-blur-md rounded-full active:scale-95 transition-transform">
          <Search size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-12">
        {/* Current Weather */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-8"
        >
          <div className="relative">
            {getIcon(weather.condition, 100)}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-300/20 rounded-full blur-2xl"></div>
          </div>
          <h1 className="text-7xl font-bold mt-4 relative">
            {weather.temp}
            <span className="absolute -top-2 -right-6 text-3xl font-light">°</span>
          </h1>
          <p className="text-xl font-medium mt-2">{weather.condition}</p>
          <div className="flex gap-4 mt-2 opacity-90">
            <span>最高: {weather.high}°</span>
            <span>最低: {weather.low}°</span>
          </div>
        </motion.div>

        {/* Hourly Forecast */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl p-4 mt-6 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4 opacity-80">
            <Wind size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">24小时预报</span>
          </div>
          <div className="flex overflow-x-auto gap-6 scrollbar-hide pb-2">
            {weather.hourly.map((item, index) => (
              <div key={index} className="flex flex-col items-center gap-2 shrink-0">
                <span className="text-xs opacity-80">{item.time}</span>
                {getIcon(item.condition, 20)}
                <span className="font-bold">{item.temp}°</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 7-Day Forecast */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl p-4 mt-4 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4 opacity-80">
            <Calendar size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">7天预报</span>
          </div>
          <div className="flex flex-col gap-4">
            {weather.forecast.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="w-12 font-medium">{item.day}</span>
                <div className="flex items-center gap-2 flex-1 justify-center">
                  {getIcon(item.condition, 18)}
                  <span className="text-sm opacity-80">{item.condition}</span>
                </div>
                <div className="flex gap-4 w-20 justify-end">
                  <span className="font-bold">{item.temp}°</span>
                  <span className="opacity-60">{item.temp - 4}°</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <DetailCard icon={<Sunrise size={16} />} label="日出" value="06:12" />
          <DetailCard icon={<Sunset size={16} />} label="日落" value="18:45" />
          <DetailCard icon={<Droplets size={16} />} label="湿度" value={`${weather.humidity}%`} />
          <DetailCard icon={<Wind size={16} />} label="风速" value={`${weather.windSpeed} km/h`} />
          <DetailCard icon={<Sun size={16} />} label="紫外线" value={weather.uvIndex.toString()} />
          <DetailCard icon={<Thermometer size={16} />} label="气压" value={`${weather.pressure} hPa`} />
        </div>
      </div>
    </div>
  );
};

const DetailCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10">
    <div className="flex items-center gap-2 opacity-60 mb-2">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-xl font-bold">{value}</span>
  </div>
);
