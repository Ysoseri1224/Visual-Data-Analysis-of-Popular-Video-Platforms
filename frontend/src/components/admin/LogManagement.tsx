import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// 日志类型定义
type LogLevel = 'info' | 'warning' | 'error';

// 日志来源模块类型
type LogSource = '对话模块' | '数据可视化模块' | '数据管理模块';

type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  userId?: string;
  details?: string;
};

// 生成随机日志数据
const generateMockLogs = (count: number): LogEntry[] => {
  const logs: LogEntry[] = [];
  const now = new Date();
  const sources: LogSource[] = ['对话模块', '数据可视化模块', '数据管理模块'];
  const userIds = ['user_1', 'user_2', 'user_3', 'user_4', 'admin_1'];
  
  // 信息类日志消息 - 按模块分组
  const infoMessages = {
    '对话模块': [
      '用户发起新对话',
      '对话历史加载成功',
      '对话消息发送成功',
      '对话标题更新',
      '模型切换到DeepSeek',
      '对话导出成功'
    ],
    '数据可视化模块': [
      '图表生成成功',
      '数据查询完成',
      '图表类型切换',
      '可视化配置保存',
      '数据集加载成功',
      '图表导出完成'
    ],
    '数据管理模块': [
      '数据连接创建成功',
      '数据导入完成',
      '表结构加载成功',
      '数据同步完成',
      '数据字典更新',
      '数据源连接测试成功'
    ]
  };
  
  // 警告类日志消息 - 按模块分组
  const warningMessages = {
    '对话模块': [
      '消息发送超时，已重试',
      '对话响应时间过长',
      '多次连续发送相同消息',
      '消息内容过长，已截断',
      '模型切换过于频繁',
      '对话历史加载缓慢'
    ],
    '数据可视化模块': [
      '图表数据量过大，可能影响性能',
      '查询返回行数过多',
      'SQL查询复杂度过高',
      '图表渲染时间过长',
      '数据类型不匹配所选图表',
      '可能存在重复数据'
    ],
    '数据管理模块': [
      '数据库连接超时，已重试',
      '表结构变更可能影响查询',
      '大量数据导入进行中，可能影响性能',
      '连接池接近限制',
      '可能的SQL注入尝试',
      '存在未使用的数据连接'
    ]
  };
  
  // 错误类日志消息 - 按模块分组
  const errorMessages = {
    '对话模块': [
      'DeepSeek API调用失败',
      '消息处理异常',
      '消息内容解析错误',
      '对话历史读取失败',
      '无法创建新对话',
      '对话连接中断'
    ],
    '数据可视化模块': [
      'SQL语法错误',
      '图表渲染失败',
      '查询超时',
      '数据格式转换错误',
      '无法生成图表',
      '数据集访问权限不足'
    ],
    '数据管理模块': [
      '数据库连接失败',
      '表创建错误',
      '数据导入失败',
      '数据完整性错误',
      '数据类型不兼容',
      '表结构更新失败'
    ]
  };
  
  for (let i = 0; i < count; i++) {
    // 随机生成日志级别，保持一定比例
    const levelRandom = Math.random();
    let level: LogLevel;
    
    if (levelRandom < 0.7) {
      level = 'info';
    } else if (levelRandom < 0.9) {
      level = 'warning';
    } else {
      level = 'error';
    }
    
    // 随机生成时间戳，最近的日志更新
    const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000).toISOString();
    
    // 随机选择模块来源
    const source: LogSource = sources[Math.floor(Math.random() * sources.length)];
    
    // 根据模块和级别选择对应的消息列表
    let messageList: string[];
    if (level === 'info') {
      messageList = infoMessages[source];
    } else if (level === 'warning') {
      messageList = warningMessages[source];
    } else {
      messageList = errorMessages[source];
    }
    
    // 随机选择消息
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    
    // 只有部分日志有用户ID
    const hasUserId = Math.random() > 0.3;
    const userId = hasUserId ? userIds[Math.floor(Math.random() * userIds.length)] : undefined;
    
    // 生成随机详情
    const details = level === 'error' ? 
      `错误代码: E${Math.floor(Math.random() * 1000)}, 位置: ${source}服务, 堆栈: Function${Math.floor(Math.random() * 10)}` : 
      undefined;
    
    logs.push({
      id: `log_${i}`,
      timestamp,
      level,
      message,
      source,
      userId,
      details
    });
  }
  
  // 按时间戳排序，最新的在前面
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export default function LogManagement() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // 加载日志数据
  useEffect(() => {
    const fetchLogs = () => {
      setLoading(true);
      
      // 模拟API调用
      setTimeout(() => {
        const mockLogs = generateMockLogs(100);
        setLogs(mockLogs);
        setLoading(false);
      }, 800);
    };
    
    fetchLogs();
    
    // 设置自动刷新
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        // 添加一些新日志
        const newLogs = generateMockLogs(5);
        setLogs(prevLogs => [...newLogs, ...prevLogs].slice(0, 100)); // 保持最多100条日志
      }, 10000); // 每10秒刷新一次
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);
  
  // 筛选日志
  useEffect(() => {
    if (logs.length === 0) return;
    
    // 应用筛选条件
    let filtered = [...logs];
    
    // 搜索词筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.source.toLowerCase().includes(term) ||
        (log.userId && log.userId.toLowerCase().includes(term)) ||
        (log.details && log.details.toLowerCase().includes(term))
      );
    }
    
    // 级别筛选
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }
    
    // 来源筛选
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }
    
    // 时间范围筛选
    const now = new Date();
    let timeLimit: Date;
    
    switch (timeRange) {
      case '1h':
        timeLimit = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeLimit = new Date(0); // 所有时间
    }
    
    filtered = filtered.filter(log => new Date(log.timestamp) > timeLimit);
    
    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, sourceFilter, timeRange]);
  
  // 查看日志详情
  const handleViewDetails = (log: LogEntry) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };
  
  // 获取唯一的日志来源列表
  const uniqueSources = Array.from(new Set(logs.map(log => log.source)));
  
  // 日志级别对应的样式
  const getLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // 日志行的背景颜色
  const getRowStyle = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'hover:bg-green-900/10';
      case 'warning':
        return 'hover:bg-yellow-900/10';
      case 'error':
        return 'hover:bg-red-900/10';
      default:
        return 'hover:bg-gray-700/50';
    }
  };
  
  // 日志消息的颜色
  const getMessageStyle = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-space-accent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-semibold">日志管理</h2>
        
        <div className="flex flex-wrap gap-3">
          {/* 自动刷新开关 */}
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-space-accent"></div>
              <span className="ml-2 text-sm font-medium text-gray-300">自动刷新</span>
            </label>
          </div>
          
          {/* 时间范围选择 */}
          <select
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">最近1小时</option>
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="all">所有时间</option>
          </select>
          
          {/* 手动刷新按钮 */}
          <button
            onClick={() => setLogs(generateMockLogs(100))}
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm hover:bg-space-dark transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 搜索框 */}
        <div className="relative">
          <input
            type="text"
            placeholder="搜索日志内容..."
            className="bg-space-dark/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* 日志级别筛选 */}
        <select
          className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as 'all' | LogLevel)}
        >
          <option value="all">所有级别</option>
          <option value="info">信息</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
        </select>
        
        {/* 日志来源筛选 */}
        <select
          className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">所有来源</option>
          {uniqueSources.map((source, index) => (
            <option key={index} value={source}>{source}</option>
          ))}
        </select>
      </div>

      {/* 日志统计信息 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          显示 <span className="text-white font-medium">{filteredLogs.length}</span> 条日志
          {levelFilter !== 'all' && (
            <span> (筛选: <span className="text-white">{levelFilter}</span>)</span>
          )}
          {sourceFilter !== 'all' && (
            <span> (来源: <span className="text-white">{sourceFilter}</span>)</span>
          )}
        </div>
        
        {/* 日志级别统计 */}
        <div className="flex gap-2 ml-auto">
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/20 text-green-400">
            信息: {logs.filter(log => log.level === 'info').length}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-900/20 text-yellow-400">
            警告: {logs.filter(log => log.level === 'warning').length}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/20 text-red-400">
            错误: {logs.filter(log => log.level === 'error').length}
          </span>
        </div>
      </div>

      {/* 日志表格 */}
      <div 
        ref={logContainerRef}
        className="overflow-x-auto rounded-lg border border-gray-700 max-h-[600px] overflow-y-auto"
      >
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-space-dark/70 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">时间</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">级别</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">来源</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">消息</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">用户ID</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-space-dark/30 divide-y divide-gray-700">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <motion.tr 
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`${getRowStyle(log.level)} cursor-pointer`}
                  onClick={() => handleViewDetails(log)}
                >
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-300">
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getLevelStyle(log.level)}`}>
                      {log.level === 'info' ? '信息' : log.level === 'warning' ? '警告' : '错误'}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-300">
                    {log.source}
                  </td>
                  <td className="px-6 py-3 text-sm max-w-xs truncate">
                    <span className={getMessageStyle(log.level)}>{log.message}</span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400">
                    {log.userId || '-'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(log);
                      }}
                      className="text-space-accent hover:text-space-accent/80 transition-colors"
                    >
                      详情
                    </button>
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                  没有找到匹配的日志记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 日志详情模态框 */}
      {isDetailsModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-space-dark border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-white">日志详情</h3>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">时间</p>
                  <p className="text-white">{new Date(selectedLog.timestamp).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">级别</p>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getLevelStyle(selectedLog.level)}`}>
                    {selectedLog.level === 'info' ? '信息' : selectedLog.level === 'warning' ? '警告' : '错误'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">来源</p>
                  <p className="text-white">{selectedLog.source}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">用户ID</p>
                  <p className="text-white">{selectedLog.userId || '-'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-400 mb-1">消息</p>
                <p className={`${getMessageStyle(selectedLog.level)} font-medium`}>{selectedLog.message}</p>
              </div>
              
              {selectedLog.details && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">详细信息</p>
                  <pre className="bg-space-dark/50 p-3 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                    {selectedLog.details}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 bg-space-accent hover:bg-space-accent/80 text-white text-sm rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
