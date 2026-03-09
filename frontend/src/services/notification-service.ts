/**
 * 通知服务 - 用于管理浏览器通知和提醒
 */

// 获取用户的通知设置
const getNotificationSettings = (): { 
  browser: boolean; 
  systemUpdates: boolean;
  newFeatures: boolean;
  usageReminders: boolean;
} => {
  try {
    const settings = localStorage.getItem('notificationSettings');
    if (settings) {
      return JSON.parse(settings);
    }
  } catch (error) {
    console.error('获取通知设置失败:', error);
  }
  
  // 默认设置
  return {
    browser: true,
    systemUpdates: true,
    newFeatures: true,
    usageReminders: false
  };
};

// 保存通知设置到本地存储
const saveNotificationSettings = (settings: any) => {
  try {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('保存通知设置失败:', error);
  }
};

// 请求浏览器通知权限
const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('此浏览器不支持桌面通知');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// 发送浏览器通知
const sendBrowserNotification = (
  title: string, 
  body: string, 
  icon: string = '/logo.png',
  notificationType: 'systemUpdates' | 'newFeatures' | 'usageReminders' = 'systemUpdates'
): void => {
  const settings = getNotificationSettings();
  
  // 检查用户是否启用了该类型的通知
  if (!settings.browser || !settings[notificationType]) {
    return;
  }
  
  // 检查浏览器通知权限
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon,
      tag: notificationType,
    });
    
    // 点击通知时的行为
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    // 5秒后自动关闭
    setTimeout(() => {
      notification.close();
    }, 5000);
  } else if (Notification.permission !== 'denied') {
    // 如果没有权限，则请求权限
    requestNotificationPermission().then(granted => {
      if (granted) {
        sendBrowserNotification(title, body, icon, notificationType);
      }
    });
  }
};

// 系统更新通知
const notifySystemUpdate = (version: string, updateDetails: string): void => {
  sendBrowserNotification(
    `系统已更新至 ${version}`, 
    updateDetails,
    '/logo.png',
    'systemUpdates'
  );
};

// 新功能通知
const notifyNewFeature = (featureName: string, featureDescription: string): void => {
  sendBrowserNotification(
    `新功能: ${featureName}`, 
    featureDescription,
    '/logo.png',
    'newFeatures'
  );
};

// 使用提醒通知
const notifyUsageReminder = (message: string): void => {
  sendBrowserNotification(
    '使用提醒', 
    message,
    '/logo.png',
    'usageReminders'
  );
};

// 测试通知功能
const testNotification = (type: 'systemUpdates' | 'newFeatures' | 'usageReminders'): void => {
  const testMessages = {
    systemUpdates: {
      title: '系统更新测试',
      body: '这是一条系统更新测试通知，如果您看到此消息，说明系统更新通知功能正常。'
    },
    newFeatures: {
      title: '新功能测试',
      body: '这是一条新功能测试通知，如果您看到此消息，说明新功能通知功能正常。'
    },
    usageReminders: {
      title: '使用提醒测试',
      body: '这是一条使用提醒测试通知，如果您看到此消息，说明使用提醒通知功能正常。'
    }
  };
  
  const message = testMessages[type];
  sendBrowserNotification(message.title, message.body, '/logo.png', type);
};

// 导出所有函数
export const NotificationService = {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  sendBrowserNotification,
  notifySystemUpdate,
  notifyNewFeature,
  notifyUsageReminder,
  testNotification
};

export default NotificationService;
