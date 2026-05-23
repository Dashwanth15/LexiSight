import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function VideoTranslator({
  videoUrl,
  isLoaded,
  isPlaying,
  isProcessing,
  progress,
  currentSign,
  debugInfo,       // NEW
  onPlay,
  onPause,
  onEnded,         // NEW
  videoRef,
  onUpload,
  onReset
}) {
  const fileInputRef = useRef(null)

  return (
    <div className="flex flex-col gap-4 w-full h-full max-h-full">
      {/* ── Video Display Area ─────────────────────────────── */}
      <div 
        className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0"
        style={{ aspectRatio: '16/9', minHeight: 240 }}
      >
        {!isLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
            <span style={{ fontSize: '3rem', opacity: 0.5 }}>📂</span>
            <p className="mt-3 text-sm text-slate-400 font-dm">
              Upload a clear video to translate signs.
            </p>
            <button 
              className="mt-4 btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Video
            </button>
            <input 
              type="file" 
              accept="video/mp4,video/webm,video/quicktime" 
              className="hidden" 
              ref={fileInputRef}
              onChange={onUpload}
            />
          </div>
        ) : (
          <>
            <video 
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              loop={false}           // FIX — disable loop so ended fires
              crossOrigin="anonymous"
              muted
              onEnded={onEnded}      // FIX — handle video end
            />
            
            {/* Live Detection Overlay during playback */}
            <AnimatePresence>
              {isProcessing && currentSign && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
                  style={{ 
                    background: 'rgba(8,13,20,0.85)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}
                >
                  <div className="flex flex-col items-center">
                    {/* NEW — mode indicator */}
                    <span className="text-[0.6rem] font-mono uppercase tracking-wider mb-1" style={{ color: '#00d4ff80' }}>
                      {debugInfo?.smoothed ? '🟢 LOCKED' : '🔍 DETECTING'}
                    </span>
                    <span className="text-2xl font-bold text-emerald-400 font-syne leading-none">
                      {currentSign.label}
                    </span>
                    {currentSign.confidence && (
                      <span className="text-[0.65rem] text-emerald-400/70 font-mono mt-1">
                        {(currentSign.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {/* NEW — source + buffer info */}
                    {debugInfo && (
                      <span className="text-[0.55rem] font-mono mt-0.5" style={{ color: '#4a6a80' }}>
                        [{debugInfo.source}] buf:{(debugInfo.bufferProgress * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Bar overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div 
                className="h-full bg-cyan-400 transition-all duration-150 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Controls Area ──────────────────────────────────── */}
      {isLoaded && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/50 border border-white/5">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button 
                className="btn-primary flex items-center gap-2" 
                style={{ minWidth: 100 }}
                onClick={onPlay}
              >
                <span>▶</span> Play
              </button>
            ) : (
              <button 
                className="btn-secondary flex items-center gap-2" 
                style={{ minWidth: 100, borderColor: '#ffaa00', color: '#ffaa00' }}
                onClick={onPause}
              >
                <span>⏸</span> Pause
              </button>
            )}
            
            <button 
              className="btn-secondary flex items-center gap-2"
              onClick={onReset}
            >
              <span>↺</span> Reset
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="video/mp4,video/webm,video/quicktime" 
              className="hidden" 
              ref={fileInputRef}
              onChange={onUpload}
            />
            <button 
              className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-4"
              onClick={() => fileInputRef.current?.click()}
            >
              Load New Video
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
