import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, Repeat, Shuffle } from 'lucide-react';

interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
}

const mockPlaylist: Song[] = [
  { id: '1', title: '示例歌曲 1', artist: '艺术家 A', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'https://picsum.photos/seed/music1/100/100' },
  { id: '2', title: '示例歌曲 2', artist: '艺术家 B', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', cover: 'https://picsum.photos/seed/music2/100/100' },
];

export const MusicPlayer: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<Song>(mockPlaylist[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-white rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-6">我的歌单</h2>
        <div className="space-y-2">
          {mockPlaylist.map((song) => (
            <div 
              key={song.id} 
              className={`flex items-center p-3 rounded-lg cursor-pointer ${currentSong.id === song.id ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}
              onClick={() => { setCurrentSong(song); setIsPlaying(true); }}
            >
              <img src={song.cover} alt={song.title} className="w-12 h-12 rounded-md mr-4" referrerPolicy="no-referrer" />
              <div>
                <div className="font-medium">{song.title}</div>
                <div className="text-sm text-neutral-400">{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <audio ref={audioRef} src={currentSong.url} />
    </div>
  );
};
