import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:8080/api/v1';

// 系统监控数据类型
export interface MonitoringData {
  timestamp: string;
  server_load: number;
  memory_usage: number;
  disk_usage: number;
  active_users: number;
  api_calls: number;
  response_time: number;
  error_rate: number;
}

type TimeRange = '1h' | '24h' | '7d' | '30d';

// 获取实时系统状态
const fetchRealTimeStats = async (): Promise<MonitoringData | null> => {
  try {
    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到登录凭证');
      return null;
    }
    
    // 发起API请求
    const response = await axios.get(`${API_BASE_URL}/monitoring/system-stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return {
      timestamp: response.data.timestamp,
      server_load: response.data.server_load,
      memory_usage: response.data.memory_usage,
      disk_usage: response.data.disk_usage,
      active_users: response.data.active_users,
      api_calls: response.data.api_calls,
      response_time: response.data.response_time,
      error_rate: response.data.error_rate,
    };
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return null;
  }
};

// 获取历史统计数据
const fetchHistoricalData = async (range: TimeRange): Promise<MonitoringData[]> => {
  try {
    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到登录凭证');
      return [];
    }
    
    // 发起API请求
    const response = await axios.get(`${API_BASE_URL}/monitoring/historical-stats`, {
      params: { time_range: range },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 如果数据为空，返回空数组
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return [];
    }
    
    // 转换响应数据
    return response.data;
  } catch (error) {
    console.error('获取历史数据失败:', error);
    return [];
  }
};

export default function SystemMonitoring() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // 秒
  
  // 加载监控数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // 获取历史数据
        const historicalData = await fetchHistoricalData(timeRange);
        if (historicalData.length > 0) {
          setData(historicalData);
        } else {
          // 如果没有历史数据，尝试获取实时状态
          const realTimeData = await fetchRealTimeStats();
          if (realTimeData) {
            setData([realTimeData]);
          }
        }
      } catch (error) {
        console.error('获取监控数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // 设置自动刷新
    const intervalId = setInterval(fetchData, refreshInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [timeRange, refreshInterval]);
  
  // 获取最新的数据点
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  
  // 计算平均值和最大值
  const calculateStats = (key: keyof MonitoringData) => {
    if (data.length === 0) return { avg: 0, max: 0 };
    
    const values = data.map(d => d[key] as number);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    
    return { avg, max };
  };
  
  // 渲染简单的图表
  const renderChart = (title: string, data: number[], unit: string, color: string) => {
    if (data.length === 0) return null;
    
    // 只显示最近24个数据点，确保图表不会过于密集
    const displayData = data.slice(-24);
    const max = Math.max(...displayData) * 1.1; // 增加10%的空间
    
    return (
      <div className="bg-space-dark/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <span className="text-xs text-gray-400">单位: {unit}</span>
        </div>
        
        {/* 表格形式显示数据 */}
        <div className="overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <tbody>
              <tr className="text-center">
                {displayData.map((value, index) => (
                  <td key={index} className="px-1 py-1 text-xs">
                    {value.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr>
                {displayData.map((value, index) => {
                  const height = (value / max) * 100;
                  return (
                    <td key={index} className="px-1 py-0 align-bottom">
                      <div 
                        className={`w-full ${color} rounded-t-sm`}
                        style={{ height: `${Math.max(5, height)}px` }}
                      ></div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-space-accent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-semibold">系统监控</h2>
        
        <div className="flex flex-wrap gap-3">
          {/* 时间范围选择 */}
          <div className="flex rounded-lg overflow-hidden">
            {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium ${timeRange === range ? 'bg-space-accent text-white' : 'bg-space-dark/70 text-gray-300 hover:bg-space-dark'}`}
              >
                {range === '1h' ? '1小时' : range === '24h' ? '24小时' : range === '7d' ? '7天' : '30天'}
              </button>
            ))}
          </div>
          
          {/* 刷新间隔选择 */}
          <select
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
          >
            <option value="10">10秒刷新</option>
            <option value="30">30秒刷新</option>
            <option value="60">1分钟刷新</option>
            <option value="300">5分钟刷新</option>
          </select>
          
          {/* 手动刷新按钮 */}
          <button
            onClick={() => setTimeRange(timeRange)} // 触发重新加载
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm hover:bg-space-dark transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* 关键指标卡片 - 简化版本 */}
      {latestData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 服务器负载 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">服务器负载</h3>
              <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                latestData.server_load > 80 ? 'bg-red-500/20 text-red-400' : 
                latestData.server_load > 60 ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-green-500/20 text-green-400'
              }`}>
                {latestData.server_load > 80 ? '高' : latestData.server_load > 60 ? '中' : '低'}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold text-white">{latestData.server_load.toFixed(2)}%</div>
              <div className="text-xs text-gray-400">
                平均: {calculateStats('server_load').avg.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* API调用次数 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">API调用次数</h3>
              <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                正常
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold text-white">{latestData.api_calls.toLocaleString()}</div>
              <div className="text-xs text-gray-400">
                平均: {calculateStats('api_calls').avg.toFixed(0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 响应时间 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">响应时间</h3>
              <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                latestData.response_time > 500 ? 'bg-red-500/20 text-red-400' : 
                latestData.response_time > 300 ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-green-500/20 text-green-400'
              }`}>
                {latestData.response_time > 500 ? '缓慢' : latestData.response_time > 300 ? '一般' : '快速'}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold text-white">{latestData.response_time.toFixed(2)} ms</div>
              <div className="text-xs text-gray-400">
                平均: {calculateStats('response_time').avg.toFixed(2)} ms
              </div>
            </div>
          </div>

          {/* 错误率 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">错误率</h3>
              <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                latestData.error_rate > 3 ? 'bg-red-500/20 text-red-400' : 
                latestData.error_rate > 1 ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-green-500/20 text-green-400'
              }`}>
                {latestData.error_rate > 3 ? '较高' : latestData.error_rate > 1 ? '一般' : '良好'}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold text-white">{latestData.error_rate.toFixed(2)}%</div>
              <div className="text-xs text-gray-400">
                平均: {calculateStats('error_rate').avg.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图表部分 - 使用表格形式显示数据 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">系统监控数据</h3>
            <div className="text-xs text-gray-400">最近 {data.length} 个数据点</div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-space-dark/70">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">时间</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <span className="text-purple-400">服务器负载 (%)</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <span className="text-blue-400">API调用次数</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <span className="text-green-400">响应时间 (ms)</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <span className="text-red-400">错误率 (%)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-space-dark/30 divide-y divide-gray-700">
                {data.slice(-10).reverse().map((item, index) => (
                  <tr key={index} className="hover:bg-space-dark/50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                      {new Date(item.timestamp).toLocaleString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      <span className={`${
                        item.server_load > 80 ? 'text-red-400' : 
                        item.server_load > 60 ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}>
                        {item.server_load.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-400 text-right">
                      {item.api_calls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      <span className={`${
                        item.response_time > 500 ? 'text-red-400' : 
                        item.response_time > 300 ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}>
                        {item.response_time.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      <span className={`${
                        item.error_rate > 3 ? 'text-red-400' : 
                        item.error_rate > 1 ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}>
                        {item.error_rate.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 系统资源使用情况 */}
      {latestData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 内存使用 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">内存使用</h3>
              <span className="text-xs text-gray-400">{latestData.memory_usage.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${latestData.memory_usage > 80 ? 'bg-red-500' : latestData.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${latestData.memory_usage}%` }}
              ></div>
            </div>
          </div>
          
          {/* 磁盘使用 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">磁盘使用</h3>
              <span className="text-xs text-gray-400">{latestData.disk_usage.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${latestData.disk_usage > 80 ? 'bg-red-500' : latestData.disk_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${latestData.disk_usage}%` }}
              ></div>
            </div>
          </div>
          
          {/* 活跃用户 */}
          <div className="bg-space-dark/50 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">当前活跃用户</h3>
              <span className="text-xs text-gray-400">{latestData.active_users.toFixed(0)} 用户</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="h-2.5 rounded-full bg-blue-500"
                style={{ width: `${Math.min(100, (latestData.active_users / 200) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
