import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { format } from 'date-fns';

// 定义类型
interface Memory {
  id: string;
  conversation_id: string;
  title: string;
  user_question: string;
  system_answer: string;
  created_at: string;
  updated_at: string;
}

interface MemoryDetail {
  id: string;
  conversation_id: string;
  title: string;
  user_question: string;
  system_answer: string;
  created_at: string;
  updated_at: string;
}

export default function MemoryManage() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<MemoryDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_conversations: 0,
    total_messages: 0
  });
  // 记忆库管理页面功能

  // 获取记忆库列表
  useEffect(() => {
    fetchMemories();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 获取用户认证令牌
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未登录或认证令牌已过期，请重新登录');
        return;
      }
      
      const response = await fetch('http://localhost:8080/api/v1/memory/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'success') {
          setStats(data.data);
        } else {
          setError(data.message || '获取记忆库统计信息失败');
        }
      } else {
        setError(`API响应异常: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('获取记忆库统计信息失败:', error);
    }
  };

  const fetchMemories = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 获取用户认证令牌
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未登录或认证令牌已过期，请重新登录');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch('http://localhost:8080/api/v1/memory/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`响应不是有效的JSON: ${responseText.substring(0, 100)}...`);
      }
      
      if (response.ok) {
        
        if (data.status === 'success') {
          if (Array.isArray(data.data)) {
            if (data.data.length > 0) {
            } else {
            }
          } else {
          }
          setMemories(data.data || []);
        } else {
          setError(data.message || '获取记忆库数据失败');
        }
      } else {
        const errMsg = `API调用失败: ${response.status} ${response.statusText}`;
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error('获取记忆库数据失败:', error);
      setError('无法获取记忆库数据，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMemory = (memory: Memory) => {
    // 直接使用内存中的记忆数据显示详情，无需再次请求
    setSelectedMemory(memory);
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteMemory = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      // 获取用户认证令牌
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未登录或认证令牌已过期，请重新登录');
        setIsDeleting(false);
        return;
      }

      const response = await fetch(`http://localhost:8080/api/v1/memory/conversations/${deleteTarget}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          // 更新记忆库列表
          setMemories(memories.filter(memory => memory.id !== deleteTarget));
          // 关闭弹窗
          setDeleteTarget(null);
          // 如果删除的是当前查看的记忆，也关闭详情弹窗
          if (selectedMemory && selectedMemory.id === deleteTarget) {
            setIsModalOpen(false);
            setSelectedMemory(null);
          }
          // 刷新统计数据
          fetchStats();
        } else {
          setError(data.message || '删除记忆失败');
        }
      } else {
        throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('删除记忆失败:', error);
      setError('无法删除记忆，请检查网络连接');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  return (
    <DashboardLayout title="记忆库管理">
      <div className="flex flex-col h-full min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">记忆库管理</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors mr-2"
            >
              返回仪表盘
            </button>
            <button 
              onClick={() => router.push('/data')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              返回数据面板
            </button>
          </div>
        </div>
        
        {/* 统计信息标题 */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-blue-300">记忆库统计信息</h2>
        </div>

        {/* 统计信息 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="card-space p-6"
          >
            <h3 className="text-lg font-medium text-white mb-2">记忆条目总数</h3>
            <p className="text-3xl font-bold text-indigo-400">{stats.total_conversations}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card-space p-6"
          >
            <h3 className="text-lg font-medium text-white mb-2">总消息数</h3>
            <p className="text-3xl font-bold text-purple-400">{stats.total_messages}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="card-space p-6"
          >
            <h3 className="text-lg font-medium text-white mb-2">平均每条记忆消息数</h3>
            <p className="text-3xl font-bold text-blue-400">
              {stats.total_conversations > 0 
                ? (stats.total_messages / stats.total_conversations).toFixed(1) 
                : "0"}
            </p>
          </motion.div>
        </div>

        {/* 记忆库列表 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl mb-4">记忆库列表</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 mb-6 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-2">暂无记忆库条目</p>
              <p className="text-sm">开始与AI助手对话，自动创建记忆库条目</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-900 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-3 text-left text-gray-300">标题</th>
                    <th className="px-4 py-3 text-left text-gray-300">创建时间</th>
                    <th className="px-4 py-3 text-left text-gray-300">最后更新</th>
                    <th className="px-4 py-3 text-left text-gray-300">消息数</th>
                    <th className="px-4 py-3 text-center text-gray-300">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {memories.map((memory) => (
                    <tr key={memory.id} className="border-t border-gray-700 hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-blue-400">{memory.title || '无标题对话'}</td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(memory.created_at)}</td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(memory.updated_at)}</td>
                      <td className="px-4 py-3 text-center text-gray-300">1 条</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <button 
                            onClick={() => handleViewMemory(memory)}
                            className="px-3 py-1 bg-blue-600/50 hover:bg-blue-600 rounded text-sm transition-colors"
                          >
                            查看
                          </button>
                          <button 
                            onClick={() => confirmDelete(memory.id)}
                            className="px-3 py-1 bg-red-600/50 hover:bg-red-600 rounded text-sm transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 记忆详情弹窗 - 显示问答对详情 */}
      {isModalOpen && selectedMemory && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-medium text-white">
                {selectedMemory.title || '无标题问答'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-grow">
              <div className="space-y-4">
                {/* 用户问题 */}
                <div className="p-4 rounded-lg bg-blue-900/30 border border-blue-900"> 
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white">用户</span>
                    <span className="text-xs text-gray-400">
                      {formatDate(selectedMemory.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-200 whitespace-pre-wrap">{selectedMemory.user_question}</p>
                </div>
                
                {/* 系统回答 */}
                <div className="p-4 rounded-lg bg-purple-900/30 border border-purple-900">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white">系统</span>
                    <span className="text-xs text-gray-400">
                      {formatDate(selectedMemory.updated_at)}
                    </span>
                  </div>
                  <p className="text-gray-200 whitespace-pre-wrap">{selectedMemory.system_answer}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-medium text-white mb-4">确认删除</h3>
            <p className="text-gray-300 mb-6">确定要删除这条记忆吗？此操作无法撤销。</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                disabled={isDeleting}
              >
                取消
              </button>
              <button 
                onClick={handleDeleteMemory}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
