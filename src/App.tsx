/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, Trophy, Gamepad2, Volume2, MessageSquare, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';

// --- Types ---
interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  color: string;
}
interface Point {
  x: number;
  y: number;
}

interface Track {
  id: number;
  title: string;
  artist: string;
  url: string;
  color: string;
}

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION: Point = { x: 0, y: -1 };
const GAME_SPEED = 100;

const TRACKS: Track[] = [
  {
    id: 1,
    title: "VOID_SIGNAL_01",
    artist: "NULL_ENTITY",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    color: "from-cyan-500 to-blue-500"
  },
  {
    id: 2,
    title: "NEURAL_STATIC",
    artist: "GHOST_IN_SHELL",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    color: "from-magenta-500 to-purple-500"
  },
  {
    id: 3,
    title: "BINARY_DECAY",
    artist: "DATA_CORRUPTION",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    color: "from-emerald-500 to-teal-500"
  }
];

export default function App() {
  // --- Game State ---
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // --- Music State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Chat State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [username] = useState(`NODE_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Game Logic ---
  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const isOnSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!isOnSnake) break;
    }
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setFood(generateFood(INITIAL_SNAKE));
  };

  const moveSnake = useCallback(() => {
    if (isGameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        setIsPaused(true);
        if (score > highScore) setHighScore(score);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isGameOver, isPaused, score, highScore, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y !== 1) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y !== -1) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x !== 1) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x !== -1) setDirection({ x: 1, y: 0 });
          break;
        case ' ':
          setIsPaused(p => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    const interval = setInterval(moveSnake, GAME_SPEED);
    return () => clearInterval(interval);
  }, [moveSnake]);

  // --- Music Logic ---
  const toggleMusic = () => {
    setIsPlayingMusic(prev => !prev);
  };

  const skipTrack = (dir: 'next' | 'prev') => {
    let nextIndex = currentTrackIndex;
    if (dir === 'next') {
      nextIndex = (currentTrackIndex + 1) % TRACKS.length;
    } else {
      nextIndex = (currentTrackIndex - 1 + TRACKS.length) % TRACKS.length;
    }
    setCurrentTrackIndex(nextIndex);
    setIsPlayingMusic(true);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const playAudio = async () => {
      try {
        if (isPlayingMusic) {
          // The src change might trigger an AbortError if we play too soon
          // Browsers handle src changes asynchronously.
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (e) {
        // Ignore AbortError which occurs when a play request is interrupted by a new load
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error("Playback failed", e);
        }
      }
    };

    playAudio();
  }, [currentTrackIndex, isPlayingMusic]);

  // --- Chat Logic ---
  useEffect(() => {
    // Connect to the server
    socketRef.current = io();

    socketRef.current.on("init_messages", (initialMessages: Message[]) => {
      setMessages(initialMessages);
    });

    socketRef.current.on("receive_message", (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      user: username,
      text: newMessage,
      color: currentTrack.color.includes('cyan') ? 'text-cyan-400' : currentTrack.color.includes('purple') ? 'text-purple-400' : 'text-emerald-400'
    });
    setNewMessage("");
  };

  const currentTrack = TRACKS[currentTrackIndex];

  return (
    <div className="min-h-screen bg-black text-neon-cyan font-terminal overflow-hidden selection:bg-neon-magenta selection:text-black">
      <div className="crt-overlay" />
      <div className="scanline" />
      <div className="static-noise" />

      {/* Header */}
      <header className="relative z-10 p-6 border-b-4 border-neon-cyan flex items-center justify-between bg-black">
        <div className="flex items-center gap-4">
          <div className="p-2 pixel-border bg-neon-magenta">
            <Music className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-2xl font-pixel glitch-text tracking-tighter" data-text="SYSTEM_FAILURE_v1.0">
            SYSTEM_FAILURE_v1.0
          </h1>
        </div>
        <div className="flex gap-12 items-center">
          <button 
            onClick={() => setIsChatOpen(true)}
            className="pixel-button p-2"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-neon-magenta font-pixel mb-1">DATA_HARVEST</span>
            <span className="text-4xl font-pixel text-neon-cyan glitch-text" data-text={score.toString().padStart(4, '0')}>
              {score.toString().padStart(4, '0')}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-neon-magenta font-pixel mb-1">MAX_YIELD</span>
            <span className="text-4xl font-pixel text-neon-magenta glitch-text" data-text={highScore.toString().padStart(4, '0')}>
              {highScore.toString().padStart(4, '0')}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 p-8">
        {/* Left Panel */}
        <div className="hidden lg:flex flex-col w-64 gap-6">
          <div className="p-6 pixel-border bg-black">
            <span className="text-[10px] uppercase tracking-widest text-neon-magenta font-pixel mb-4 block">STREAM_ID</span>
            <div className="w-full aspect-square pixel-border bg-neon-magenta mb-4 flex items-center justify-center overflow-hidden">
              <motion.div
                animate={isPlayingMusic ? { scale: [1, 1.5, 1], rotate: [0, 90, 180, 270, 360] } : {}}
                transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
              >
                <Music className="w-16 h-16 text-black" />
              </motion.div>
            </div>
            <h2 className="text-lg font-pixel truncate text-neon-cyan">{currentTrack.title}</h2>
            <p className="text-sm text-neon-magenta truncate">{currentTrack.artist}</p>
          </div>
          
          <div className="p-6 pixel-border bg-black">
            <span className="text-[10px] uppercase tracking-widest text-neon-magenta font-pixel mb-4 block">CMD_INPUTS</span>
            <ul className="text-xs space-y-2 text-neon-cyan font-pixel">
              <li className="flex justify-between"><span>DIR_UP</span> <span>[↑]</span></li>
              <li className="flex justify-between"><span>DIR_DWN</span> <span>[↓]</span></li>
              <li className="flex justify-between"><span>DIR_LFT</span> <span>[←]</span></li>
              <li className="flex justify-between"><span>DIR_RGT</span> <span>[→]</span></li>
              <li className="flex justify-between"><span>HALT</span> <span>[SPC]</span></li>
            </ul>
          </div>
        </div>

        {/* Center: Game Window */}
        <div className="relative">
          <div className="pixel-border bg-black p-2">
            <div 
              className="grid bg-[#050505]" 
              style={{ 
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                width: 'min(80vw, 500px)',
                height: 'min(80vw, 500px)'
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                const x = i % GRID_SIZE;
                const y = Math.floor(i / GRID_SIZE);
                const snakeIndex = snake.findIndex(s => s.x === x && s.y === y);
                const isSnake = snakeIndex !== -1;
                const isHead = snakeIndex === 0;
                const isFood = food.x === x && food.y === y;

                return (
                  <div key={i} className="relative border-[0.5px] border-neon-cyan/10">
                    {isSnake && (
                      <div 
                        className={`absolute inset-0 ${isHead ? 'bg-neon-cyan' : 'bg-neon-magenta'} transition-all`}
                        style={{
                          opacity: isHead ? 1 : 0.8 - (snakeIndex / snake.length) * 0.5,
                          boxShadow: isHead ? '0 0 10px #00ffff' : 'none'
                        }}
                      />
                    )}
                    {isFood && (
                      <div className="absolute inset-0 bg-neon-cyan animate-pulse shadow-[0_0_15px_#00ffff]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Game Over / Start Overlay */}
            <AnimatePresence>
              {(isGameOver || isPaused) && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex flex-center items-center justify-center bg-black/90 backdrop-blur-md"
                >
                  <div className="text-center p-8 pixel-border bg-black">
                    <h2 className="text-4xl font-pixel mb-6 glitch-text" data-text={isGameOver ? "CORE_CRITICAL" : "SYSTEM_HALTED"}>
                      {isGameOver ? "CORE_CRITICAL" : "SYSTEM_HALTED"}
                    </h2>
                    {isGameOver && (
                      <p className="text-neon-magenta font-pixel mb-8">DATA_LOSS_DETECTED</p>
                    )}
                    <button 
                      onClick={resetGame}
                      className="pixel-button px-8 py-4 font-pixel text-lg"
                    >
                      {isGameOver ? "REBOOT_SYSTEM" : "RESUME_PROCESS"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Panel: Playlist (Desktop) */}
        <div className="hidden lg:flex flex-col w-80 gap-6">
          <div className="p-6 pixel-border bg-black flex-1">
            <span className="text-[10px] uppercase tracking-widest text-neon-magenta font-pixel mb-6 block">DATA_STREAMS</span>
            <div className="space-y-2">
              {TRACKS.map((track, idx) => (
                <button 
                  key={track.id}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlayingMusic(true);
                  }}
                  className={`w-full flex items-center gap-4 p-3 pixel-border transition-all ${idx === currentTrackIndex ? 'bg-neon-cyan text-black' : 'bg-black text-neon-cyan hover:bg-neon-cyan/10'}`}
                >
                  <div className={`w-10 h-10 pixel-border ${idx === currentTrackIndex ? 'bg-black' : 'bg-neon-magenta'} flex-shrink-0 flex items-center justify-center`}>
                    {idx === currentTrackIndex && isPlayingMusic ? (
                      <div className="flex gap-0.5 items-end h-3">
                        <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-neon-cyan" />
                        <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-neon-cyan" />
                        <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-neon-cyan" />
                      </div>
                    ) : (
                      <Music className={`w-4 h-4 ${idx === currentTrackIndex ? 'text-neon-cyan' : 'text-black'}`} />
                    )}
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-pixel truncate">{track.title}</p>
                    <p className="text-[10px] font-pixel opacity-60 truncate">{track.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Player Controls */}
      <footer className="relative z-10 p-6 pixel-border bg-black m-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Track Info */}
          <div className="flex items-center gap-6 w-full md:w-1/3">
            <div className="w-16 h-16 pixel-border bg-neon-magenta flex-shrink-0 flex items-center justify-center">
              <Music className="w-8 h-8 text-black" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-pixel text-neon-cyan truncate">{currentTrack.title}</h3>
              <p className="text-xs font-pixel text-neon-magenta truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-12">
            <button 
              onClick={() => skipTrack('prev')} 
              className="p-2 text-neon-cyan hover:text-white transition-colors"
            >
              <SkipBack className="w-8 h-8" />
            </button>

            <button 
              onClick={toggleMusic}
              className="w-20 h-20 pixel-border bg-neon-cyan flex items-center justify-center hover:bg-white transition-colors group"
            >
              {isPlayingMusic ? (
                <Pause className="w-10 h-10 text-black" />
              ) : (
                <Play className="w-10 h-10 text-black ml-1" />
              )}
            </button>

            <button 
              onClick={() => skipTrack('next')} 
              className="p-2 text-neon-cyan hover:text-white transition-colors"
            >
              <SkipForward className="w-8 h-8" />
            </button>
          </div>

          {/* Volume / Extra (Desktop) */}
          <div className="hidden md:flex items-center gap-4 w-1/3 justify-end">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-2 h-6 pixel-border ${i <= 3 ? 'bg-neon-cyan' : 'bg-black'}`} />
              ))}
            </div>
            <span className="font-pixel text-[10px] text-neon-cyan">VOL_60%</span>
          </div>
        </div>
      </footer>

      {/* Chat Sidebar Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-black pixel-border z-50 flex flex-col"
            >
              <div className="p-6 pixel-border flex justify-between items-center bg-black">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-neon-cyan" />
                  <h2 className="text-lg font-pixel text-neon-cyan">COMMS_LINK</h2>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 text-neon-magenta hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#050505]">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.user === username ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-pixel uppercase tracking-widest ${msg.user === username ? 'text-neon-magenta' : 'text-neon-cyan'}`}>
                        {msg.user}
                      </span>
                      <span className="text-[9px] font-pixel text-white/20">{msg.timestamp}</span>
                    </div>
                    <div className={`px-4 py-3 pixel-border max-w-[90%] text-xs font-pixel ${msg.user === username ? 'bg-neon-magenta text-black' : 'bg-black text-neon-cyan'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={sendMessage} className="p-6 pixel-border bg-black">
                <div className="relative">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="ENTER_DATA..."
                    className="w-full bg-black pixel-border py-4 px-4 text-xs font-pixel text-neon-cyan focus:outline-none focus:border-white transition-colors"
                  />
                  <button 
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neon-cyan hover:text-white transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={currentTrack.url}
        onEnded={() => skipTrack('next')}
        loop={false}
      />
    </div>
  );
}
