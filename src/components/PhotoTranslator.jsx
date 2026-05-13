import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PhotoTranslator({
  photoUrl,
  isLoaded,
  isProcessing,
  currentSign,
  onUpload,
  onReset
}) {
  const fileInputRef = useRef(null)

  return (
    <div className="flex flex-col gap-4 w-full h-full max-h-full">
      {/* ── Image Display Area ─────────────────────────────── */}
      <div 
        className="relative rounded-xl overflow-hidden bg-black/40 border flex-shrink-0"
        style={{
          aspectRatio: '4/3',
          minHeight: 240,
          borderColor: '#1a2535'
        }}
      >
        {!isLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
            <span style={{ fontSize: '3rem', opacity: 0.5 }}>📷</span>
            <p className="mt-3 text-sm font-dm" style={{ color: '#6b8ba4' }}>
              Upload a clear image to translate signs.
            </p>
            <button 
              className="mt-4"
              style={{
                padding: '8px 16px',
                background: '#00d4ff',
                color: '#020408',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              Select Photo
            </button>
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp,image/gif" 
              className="hidden" 
              ref={fileInputRef}
              onChange={onUpload}
            />
          </div>
        ) : (
          <>
            <img 
              src={photoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              alt="Uploaded photo for sign detection"
              crossOrigin="anonymous"
            />
            
            {/* Live Detection Overlay */}
            <AnimatePresence>
              {isProcessing && currentSign && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
                  style={{ 
                    transform: 'translateX(-50%)',
                    background: 'rgba(8,13,20,0.88)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-dm uppercase tracking-wider mb-1" style={{ color: '#6b8ba4' }}>Detected</span>
                    <span className="text-2xl font-bold font-syne leading-none" style={{ color: '#00ff88' }}>
                      {currentSign.label}
                    </span>
                    {currentSign.confidence && (
                      <span className="text-[0.65rem] font-mono mt-1" style={{ color: '#00ff8870' }}>
                        {(currentSign.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── Controls Area ──────────────────────────────────── */}
      {isLoaded && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl" style={{
          background: 'rgba(8,13,20,0.5)',
          border: '1px solid #1a2535'
        }}>
          <div className="flex items-center gap-2">
            <button 
              className="text-xs font-dm transition-colors"
              style={{
                padding: '6px 12px',
                background: '#ff3366',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              onClick={onReset}
            >
              ✕ Clear
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp,image/gif" 
              className="hidden" 
              ref={fileInputRef}
              onChange={onUpload}
            />
            <button 
              style={{
                fontSize: '0.75rem',
                color: '#6b8ba4',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationOffset: '4px'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              Load New Photo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
