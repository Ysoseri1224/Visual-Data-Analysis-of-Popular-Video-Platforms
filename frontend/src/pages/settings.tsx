import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useTheme } from '@/context/ThemeContext';
import NotificationService from '@/services/notification-service';

// API使用统计的模型使用情况接口
interface ModelUsage {
  model: string;
  requests: number;
  tokens: number;
}

// API使用统计接口
interface ApiUsageStats {
  totalRequests: number;
  totalTokens: number;
  limitRequests: number;
  limitTokens: number;
  usageByDay: Array<{date: string; requests: number; tokens: number}>;
  usageByModel: ModelUsage[];
}

export default function Settings() {
  // 当前选中的设置选项卡
  const [activeTab, setActiveTab] = useState('api');
  
  // API设置
  const [apiKey, setApiKey] = useState('sk-***********************************');
  const [modelName, setModelName] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  
  // API使用统计
  const [apiUsage, setApiUsage] = useState<ApiUsageStats>({
    totalRequests: 0,
    totalTokens: 0,
    limitRequests: 1000,
    limitTokens: 500000,
    usageByDay: [],
    usageByModel: []
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState('');
  
  // 系统提示词
  const [systemPrompt, setSystemPrompt] = useState(
    `你是一个专业的数据库SQL专家，专门负责将自然语言转换为SQL查询，用于数据可视化。
请严格按照以下规则：

1. 只输出SQL查询，不要有任何解释或其他文本
2. 确保SQL查询语法正确，可以直接执行
3. 针对图表类型生成适当的SQL查询
4. 使用标准SQL语法，避免使用特定数据库的扩展功能
5. 不要使用不在模式中的表或列
6. 确保生成的SQL查询结果能够直接用于图表的绘制
7. 对于聚合查询，确保GROUP BY子句包含所有非聚合列
8. 如果需要连接表，使用明确的JOIN条件
9. 对于时间序列数据，确保按时间排序
10. 对于分类数据，考虑使用ORDER BY和LIMIT来限制结果数量`
  );
  
  // 欢迎消息
  const [welcomeMessage, setWelcomeMessage] = useState(
    '欢迎使用StarData智能数据分析平台！我可以帮助您分析数据并回答问题。请告诉我您想了解什么？'
  );
  
  // 界面设置
  const { theme: currentTheme, contrast: currentContrast, fontSize: currentFontSize, setTheme: setGlobalTheme, setContrast: setGlobalContrast, setFontSize: setGlobalFontSize } = useTheme();
  const [theme, setTheme] = useState(currentTheme);
  const [contrast, setContrast] = useState(currentContrast);
  const [fontSize, setFontSize] = useState(currentFontSize);
  
  // 通知设置
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(true);
  const [notifySystemUpdates, setNotifySystemUpdates] = useState(true);
  const [notifyNewFeatures, setNotifyNewFeatures] = useState(true);
  const [notifyUsageReminders, setNotifyUsageReminders] = useState(false);
  
  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 获取API设置
  useEffect(() => {
    const fetchApiSettings = async () => {
      try {
        // 使用axios进行请求，自动包含认证令牌
        const response = await axios.get('http://localhost:8080/api/v1/settings/api-settings');
        const data = response.data;
        setApiKey(data.apiKey || 'sk-***********************************');
        setModelName(data.modelName || 'deepseek-chat');
        setTemperature(data.temperature || 0.7);
        setMaxTokens(data.maxTokens || 2000);
      } catch (error) {
        console.error('获取API设置失败:', error);
      }
    };
    
    fetchApiSettings();
  }, []);
  
  // 获取API使用统计
  useEffect(() => {
    const fetchApiUsage = async () => {
      setIsLoadingUsage(true);
      setUsageError('');
      
      try {
        // 使用axios进行请求，自动包含认证令牌
        const response = await axios.get('http://localhost:8080/api/v1/settings/api-usage');
        setApiUsage(response.data);
      } catch (error: any) {
        console.error('获取API使用统计失败:', error);
        setUsageError(
          error.response
            ? `获取使用统计数据失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            : '网络错误，无法获取使用统计数据'
        );
      } finally {
        setIsLoadingUsage(false);
      }
    };
    
    fetchApiUsage();
    
    // 每5分钟刷新一次使用统计数据
    const refreshInterval = setInterval(fetchApiUsage, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // 保存成功时清除成功提示
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);
  
  // 通知设置更改时保存到本地
  useEffect(() => {
    if (browserNotifications !== undefined) {
      // 保存到本地存储
      const settings = {
        browser: browserNotifications,
        systemUpdates: notifySystemUpdates,
        newFeatures: notifyNewFeatures,
        usageReminders: notifyUsageReminders
      };
      
      NotificationService.saveNotificationSettings(settings);
      
      // 如果开启浏览器通知，请求权限
      if (browserNotifications) {
        NotificationService.requestNotificationPermission();
      }
    }
  }, [browserNotifications, notifySystemUpdates, notifyNewFeatures, notifyUsageReminders]);

  // 处理保存设置
  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      // 准备所有设置数据
      const allSettings = {
        api: {
          apiKey,
          modelName,
          maxTokens,
          temperature  // 虽然UI中删除了温度设置，但后端仍需要这个值
        },
        prompt: {
          systemPrompt,
          welcomeMessage
        },
        interface: {
          theme,
          contrast,
          fontSize
        },
        notifications: {
          email: emailNotifications,
          browser: browserNotifications,
          systemUpdates: notifySystemUpdates,
          newFeatures: notifyNewFeatures,
          usageReminders: notifyUsageReminders
        },
        lastUpdated: new Date().toISOString()
      };
      
      // 保存所有设置
      const response = await axios.post('http://localhost:8080/api/v1/settings/all-settings', allSettings);
      
      if (response.data.success) {
        console.log('所有设置保存成功:', response.data);
        
        // 保存成功
        setSaveSuccess(true);
        
        // 3秒后清除成功消息
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        throw new Error(response.data.message || '保存设置失败');
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      
      // 显示错误消息
      const errorMessage = error.response?.data?.detail || error.message || '未知错误';
      alert(`保存设置失败: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 处理重置设置
  const handleResetSettings = () => {
    if (confirm('确定要重置所有设置吗？这将恢复默认值。')) {
      // 重置API设置
      setApiKey('sk-***********************************');
      setModelName('deepseek-chat');
      setTemperature(0.7);
      setMaxTokens(2000);
      setSystemPrompt('你是StarData智能数据分析助手，你可以帮助用户分析数据、生成SQL查询并提供数据可视化建议。');
      setWelcomeMessage('欢迎使用StarData智能数据分析平台！我可以帮助您分析数据并回答问题。请告诉我您想了解什么？');
      
      // 重置界面设置
      setTheme('dark');
      setContrast('normal');
      setFontSize('medium');
      
      // 重置通知设置
      setEmailNotifications(true);
      setBrowserNotifications(true);
      setNotifySystemUpdates(true);
      setNotifyNewFeatures(true);
      setNotifyUsageReminders(false);
    }
  };
  
  // 渲染API设置
  const renderApiSettings = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API设置 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2 card-space"
        >
          <h2 className="text-xl font-semibold text-white mb-4">API设置</h2>
          
          <div className="mb-4">
            <Input
              label="DeepSeek API密钥"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入您的API密钥"
              fullWidth
              helperText="您的API密钥将被安全加密存储"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              模型选择
            </label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
            >
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="deepseek-coder">DeepSeek Coder</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              最大令牌数 ({maxTokens})
            </label>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full h-2 bg-space-dark rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>500</span>
              <span>4000</span>
            </div>
          </div>
        </motion.div>
        
        {/* 使用统计 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card-space"
        >
          <h2 className="text-xl font-semibold text-white mb-4">使用统计</h2>
          
          {isLoadingUsage ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-space-accent"></div>
            </div>
          ) : usageError ? (
            <div className="text-center text-red-400 py-8">
              <p>{usageError}</p>
              <button 
                onClick={() => {
                  setIsLoadingUsage(true);
                  axios.get('http://localhost:8080/api/v1/settings/api-usage')
                    .then(response => {
                      setApiUsage(response.data);
                      setUsageError('');
                    })
                    .catch(err => {
                      console.error('API请求错误:', err);
                      setUsageError(
                        err.response
                          ? `获取数据失败: ${err.response.status} - ${JSON.stringify(err.response.data)}`
                          : `获取数据失败: ${err.message}`
                      );
                    })
                    .finally(() => setIsLoadingUsage(false));
                }}
                className="mt-4 px-4 py-2 bg-space-accent/20 hover:bg-space-accent/30 rounded-lg text-sm"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">本月API调用次数</p>
                <p className="text-2xl font-bold text-white">
                  {apiUsage.totalRequests.toLocaleString()} / {apiUsage.limitRequests.toLocaleString()}
                </p>
                <div className="mt-2 h-2 bg-space-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-space-accent"
                    style={{ width: `${Math.min(100, (apiUsage.totalRequests / apiUsage.limitRequests) * 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">本月令牌使用量</p>
                <p className="text-2xl font-bold text-white">
                  {apiUsage.totalTokens.toLocaleString()} / {apiUsage.limitTokens.toLocaleString()}
                </p>
                <div className="mt-2 h-2 bg-space-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-space-accent"
                    style={{ width: `${Math.min(100, (apiUsage.totalTokens / apiUsage.limitTokens) * 100)}%` }}
                  ></div>
                </div>
              </div>
              
              {apiUsage.usageByModel && apiUsage.usageByModel.length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">按模型统计</p>
                  {apiUsage.usageByModel.map((model, index) => (
                    <div key={index} className="flex justify-between text-sm mb-1">
                      <span className="text-white">{model.model}</span>
                      <span className="text-gray-300">{model.requests} 次调用 / {model.tokens.toLocaleString()} 令牌</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm">订阅计划</p>
                <p className="text-lg font-medium text-white">专业版</p>
                <p className="text-xs text-gray-400 mt-1">数据更新时间: {new Date().toLocaleString()}</p>
                <p className="text-xs text-gray-500">下次续费日期: 2025-06-05</p>
              </div>
            </div>
          )}
        </motion.div>
        
        {/* 系统提示词 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-3 card-space"
        >
          <h2 className="text-xl font-semibold text-white mb-4">系统提示词</h2>
          
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              系统提示词
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
              placeholder="输入系统提示词..."
            ></textarea>
            <p className="mt-1 text-xs text-gray-400">
              系统提示词用于指导AI助手的行为和回答方式，不会直接显示给用户。
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              欢迎消息
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
              placeholder="输入欢迎消息..."
            ></textarea>
            <p className="mt-1 text-xs text-gray-400">
              欢迎消息会在用户开始新对话时显示。
            </p>
          </div>
        </motion.div>
      </div>
    );
  };
  
  // 渲染界面设置
  const renderInterfaceSettings = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="lg:col-span-3 card-space"
      >
        <h2 className="text-xl font-semibold text-white mb-4">界面设置</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              主题颜色
            </label>
            <select
              value={theme}
              onChange={(e) => {
                const newTheme = e.target.value as "dark" | "light" | "space";
                setTheme(newTheme);
                setGlobalTheme(newTheme);
              }}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
            >
              <option value="space">星空主题</option>
              <option value="dark">暗色主题</option>
              <option value="light">浅色主题</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              选择系统的主题颜色，保持星空风格
            </p>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              对比度
            </label>
            <select
              value={contrast}
              onChange={(e) => {
                const newContrast = e.target.value;
                setContrast(newContrast);
                setGlobalContrast(newContrast);
              }}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
            >
              <option value="low">低对比度</option>
              <option value="normal">标准对比度</option>
              <option value="high">高对比度</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              调整界面元素的对比度，以适应不同的使用环境
            </p>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              字体大小
            </label>
            <select
              value={fontSize}
              onChange={(e) => {
                const newFontSize = e.target.value as "small" | "medium" | "large";
                setFontSize(newFontSize);
                setGlobalFontSize(newFontSize);
              }}
              className="bg-space-dark/50 border border-space-accent/30 text-white rounded-lg w-full p-2.5 focus:ring-2 focus:ring-space-accent focus:border-space-accent"
            >
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              调整系统文本的字体大小
            </p>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-space-dark/50 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-2">界面预览</h3>
          <div className="flex items-center justify-center bg-space-dark rounded-lg p-6 h-40">
            <div className="text-center">
              <p className="text-gray-400 mb-2">当前选择的主题: <span className="text-white font-medium">{theme === 'space' ? '星空主题' : theme === 'dark' ? '暗色主题' : '浅色主题'}</span></p>
              <p className="text-gray-400 mb-2">对比度: <span className="text-white font-medium">{contrast === 'low' ? '低' : contrast === 'normal' ? '标准' : '高'}</span></p>
              <p className="text-gray-400">字体大小: <span className="text-white font-medium">{fontSize === 'small' ? '小' : fontSize === 'medium' ? '中' : '大'}</span></p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  
  // 渲染通知设置
  const renderNotificationSettings = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="lg:col-span-3 card-space"
      >
        <h2 className="text-xl font-semibold text-white mb-4">通知设置</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-3">通知方式</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="email-notifications"
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 text-space-accent bg-space-dark border-space-accent/30 rounded focus:ring-space-accent focus:ring-2"
              />
              <label htmlFor="email-notifications" className="ml-2 text-white">
                邮件通知
              </label>
              {emailNotifications && (
                <button 
                  className="ml-4 text-xs text-space-accent hover:text-space-accent-light"
                  onClick={async () => {
                    try {
                      await axios.post('http://localhost:8080/api/v1/notifications/test-email');
                      alert('测试邮件已发送，请检查您的邮箱');
                    } catch (error) {
                      alert('测试邮件发送失败，请确认您的邮箱设置');
                      console.error('发送测试邮件失败:', error);
                    }
                  }}
                >
                  测试邮件
                </button>
              )}
            </div>
            
            <div className="flex items-center">
              <input
                id="browser-notifications"
                type="checkbox"
                checked={browserNotifications}
                onChange={(e) => {
                  setBrowserNotifications(e.target.checked);
                  if (e.target.checked) {
                    NotificationService.requestNotificationPermission();
                  }
                }}
                className="w-4 h-4 text-space-accent bg-space-dark border-space-accent/30 rounded focus:ring-space-accent focus:ring-2"
              />
              <label htmlFor="browser-notifications" className="ml-2 text-white">
                浏览器通知
              </label>
              {browserNotifications && (
                <button 
                  className="ml-4 text-xs text-space-accent hover:text-space-accent-light"
                  onClick={() => {
                    if (Notification.permission === 'granted') {
                      NotificationService.testNotification('systemUpdates');
                    } else {
                      NotificationService.requestNotificationPermission().then(granted => {
                        if (granted) {
                          NotificationService.testNotification('systemUpdates');
                        } else {
                          alert('请允许浏览器通知权限才能测试');
                        }
                      });
                    }
                  }}
                >
                  测试通知
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-3">通知类型</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="system-updates"
                type="checkbox"
                checked={notifySystemUpdates}
                onChange={(e) => setNotifySystemUpdates(e.target.checked)}
                className="w-4 h-4 text-space-accent bg-space-dark border-space-accent/30 rounded focus:ring-space-accent focus:ring-2"
              />
              <label htmlFor="system-updates" className="ml-2 text-white">
                系统更新
              </label>
              {browserNotifications && notifySystemUpdates && (
                <button 
                  className="ml-4 text-xs text-space-accent hover:text-space-accent-light"
                  onClick={() => NotificationService.testNotification('systemUpdates')}
                >
                  测试
                </button>
              )}
            </div>
            
            <div className="flex items-center">
              <input
                id="new-features"
                type="checkbox"
                checked={notifyNewFeatures}
                onChange={(e) => setNotifyNewFeatures(e.target.checked)}
                className="w-4 h-4 text-space-accent bg-space-dark border-space-accent/30 rounded focus:ring-space-accent focus:ring-2"
              />
              <label htmlFor="new-features" className="ml-2 text-white">
                新功能介绍
              </label>
              {browserNotifications && notifyNewFeatures && (
                <button 
                  className="ml-4 text-xs text-space-accent hover:text-space-accent-light"
                  onClick={() => NotificationService.testNotification('newFeatures')}
                >
                  测试
                </button>
              )}
            </div>
            
            <div className="flex items-center">
              <input
                id="usage-reminders"
                type="checkbox"
                checked={notifyUsageReminders}
                onChange={(e) => setNotifyUsageReminders(e.target.checked)}
                className="w-4 h-4 text-space-accent bg-space-dark border-space-accent/30 rounded focus:ring-space-accent focus:ring-2"
              />
              <label htmlFor="usage-reminders" className="ml-2 text-white">
                使用提醒
              </label>
              {browserNotifications && notifyUsageReminders && (
                <button 
                  className="ml-4 text-xs text-space-accent hover:text-space-accent-light"
                  onClick={() => NotificationService.testNotification('usageReminders')}
                >
                  测试
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-space-dark/50 rounded-lg">
          <p className="text-gray-400 text-sm">
            注意：邮件通知需要您在个人资料中验证您的邮箱。浏览器通知可能需要您允许浏览器权限。
          </p>
        </div>
      </motion.div>
    );
  };
  
  // 渲染设置选项卡内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'api':
        return renderApiSettings();
      case 'interface':
        return renderInterfaceSettings();
      case 'notifications':
        return renderNotificationSettings();
      default:
        return renderApiSettings();
    }
  };

  return (
    <DashboardLayout title="系统设置">
      {/* 设置选项卡 */}
      <div className="mb-6 flex overflow-x-auto space-x-2 pb-2">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'api' 
              ? 'bg-space-accent text-white' 
              : 'bg-space-dark/50 text-gray-300 hover:bg-space-dark'
          }`}
        >
          API设置
        </button>
        <button
          onClick={() => setActiveTab('interface')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'interface' 
              ? 'bg-space-accent text-white' 
              : 'bg-space-dark/50 text-gray-300 hover:bg-space-dark'
          }`}
        >
          界面设置
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'notifications' 
              ? 'bg-space-accent text-white' 
              : 'bg-space-dark/50 text-gray-300 hover:bg-space-dark'
          }`}
        >
          通知设置
        </button> 
      </div>
      
      {/* 设置内容 */}
      {renderTabContent()}
      
      {/* 操作按钮 */}
      <div className="mt-6 flex justify-end space-x-4">
        <Button
          variant="outline"
          onClick={handleResetSettings}
        >
          重置设置
        </Button>
        
        <Button
          onClick={handleSaveSettings}
          isLoading={isSaving}
        >
          {isSaving ? '保存中...' : saveSuccess ? '保存成功！' : '保存设置'}
        </Button>
      </div>
    </DashboardLayout>
  );
}