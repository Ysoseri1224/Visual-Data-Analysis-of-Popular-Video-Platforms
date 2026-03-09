import React from 'react';
import { motion } from 'framer-motion';

export type ChatMode = 'normal' | 'stream' | 'authenticated';

interface ChatModeSelectorProps {
  currentMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

const ChatModeSelector: React.FC<ChatModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="bg-space-dark rounded-lg p-2 mb-4">
      <div className="flex space-x-2">
        <button
          onClick={() => onModeChange('normal')}
          className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${currentMode === 'normal' ? 'bg-space-accent text-white' : 'bg-space-light/30 text-gray-300 hover:bg-space-light/50'}`}
        >
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>示例对话</span>
          </div>
        </button>
        <button
          onClick={() => onModeChange('stream')}
          className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${currentMode === 'stream' ? 'bg-space-accent text-white' : 'bg-space-light/30 text-gray-300 hover:bg-space-light/50'}`}
        >
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>流式对话</span>
          </div>
        </button>
        <button
          onClick={() => onModeChange('authenticated')}
          className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${currentMode === 'authenticated' ? 'bg-space-accent text-white' : 'bg-space-light/30 text-gray-300 hover:bg-space-light/50'}`}
        >
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>认证对话</span>
          </div>
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-400 text-center">
        {currentMode === 'normal' && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            示例对话模式：使用预设的对话示例，不需要联网，适合演示和测试
          </motion.p>
        )}
        {currentMode === 'stream' && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            流式对话模式：实时显示AI回复，提供更好的用户体验，不保存对话历史
          </motion.p>
        )}
        {currentMode === 'authenticated' && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            认证对话模式：需要登录，会保存对话历史到数据库，支持多设备同步
          </motion.p>
        )}
      </div>
    </div>
  );
};

export default ChatModeSelector;
