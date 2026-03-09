/**
 * 消息项组件
 * 用于展示单条聊天消息，包括用户消息和AI回复
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface MessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message: string;
  sqlQuery?: string;
  timestamp: Date;
  modelType?: 'memory' | 't5' | 'deepseek';
  onModelSwitch?: (model: 't5' | 'deepseek') => void;
  onVisualizeClick?: (sql: string) => void;
}

const MessageItem: React.FC<MessageProps> = ({
  role,
  content,
  message,
  sqlQuery,
  timestamp,
  modelType,
  onModelSwitch,
  onVisualizeClick
}) => {
  // 格式化时间
  const formattedTime = new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-3 ${role === 'user' 
          ? 'bg-blue-600 text-white' 
          : role === 'system' 
            ? 'bg-red-600 text-white' 
            : 'bg-gray-800 text-white'}`}
      >
        {/* 消息内容 */}
        <div className="whitespace-pre-wrap">{content || message}</div>
        
        {/* SQL查询语句，仅AI回复显示 */}
        {role === 'assistant' && sqlQuery && (
          <div className="mt-2 rounded-md overflow-hidden">
            <div className="bg-gray-700 text-gray-300 text-xs px-2 py-1">
              生成的SQL查询
            </div>
            <pre className="bg-gray-900 text-green-400 p-3 text-sm overflow-x-auto rounded-b-md">
              {sqlQuery}
            </pre>
          </div>
        )}
        
        {/* 时间和模型信息 */}
        <div className="mt-1 text-xs text-gray-400 flex justify-between items-center">
          <span>{formattedTime}</span>
          {role === 'assistant' && modelType && (
            <span className="bg-gray-700 rounded-full px-2 py-0.5">
              {modelType === 'memory' ? '记忆库' : modelType === 't5' ? 'T5模型' : 'DeepSeek'}
            </span>
          )}
        </div>
        
        {/* 助手消息下方的按钮 */}
        {role === 'assistant' && (
          <div className="mt-2 flex space-x-2">
            {/* {onModelSwitch && (
              <button
                onClick={() => onModelSwitch(modelType === 'deepseek' ? 't5' : 'deepseek')}
                className="text-xs bg-purple-700 hover:bg-purple-600 text-white rounded px-2 py-1 transition-colors"
              >
                {modelType === 'deepseek' ? '调用T5模型' : '问问deepseek'}
              </button>
            )} */}
            
            {/* 可视化按钮已移至输入框下方 */}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MessageItem;
