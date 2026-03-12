import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera as CameraIcon, 
  RotateCcw, 
  Zap, 
  ZapOff, 
  Image as ImageIcon,
  Circle,
  Settings
} from 'lucide-react';

export const CameraScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [flash, setFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        setIsCapturing(true);
        setTimeout(() => setIsCapturing(false), 100);
      }
    }
  };

  return (
    <div className="w-full h-full bg-black flex flex-col overflow-hidden relative">
      {/* Camera Preview */}
      <div className="flex-1 relative overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {/* Flash Overlay */}
        <AnimatePresence>
          {isCapturing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white z-50"
            />
          )}
        </AnimatePresence>

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={onBack} className="text-white p-2 active:scale-95 transition-transform">
            <X size={24} />
          </button>
          <div className="flex gap-6">
            <button onClick={() => setFlash(!flash)} className="text-white p-2 active:scale-95 transition-transform">
              {flash ? <Zap size={24} className="fill-yellow-400 text-yellow-400" /> : <ZapOff size={24} />}
            </button>
            <button className="text-white p-2 active:scale-95 transition-transform">
              <Settings size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-40 bg-black flex items-center justify-around px-8">
        <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 bg-neutral-800">
          {capturedImage ? (
            <img src={capturedImage} className="w-full h-full object-cover" alt="captured" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={20} className="text-white/40" />
            </div>
          )}
        </div>

        <button 
          onClick={takePhoto}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <div className="w-16 h-16 rounded-full bg-white" />
        </button>

        <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
          <RotateCcw size={24} />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
