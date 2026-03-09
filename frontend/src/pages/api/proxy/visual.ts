import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * 数据可视化API代理
 * 用于将前端请求转发到后端API，解决跨域问题
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只允许POST请求' });
  }

  try {
    // 后端API地址
    const backendUrls = [
      'http://localhost:8080/api/v1/visual',
      'http://127.0.0.1:8080/api/v1/visual',
    ];
    
    // 记录请求信息
    console.log('收到代理请求:', req.body);
    
    // 尝试所有可能的URL
    let response = null;
    let lastError = null;
    
    for (const url of backendUrls) {
      try {
        console.log(`尝试连接到后端: ${url}`);
        
        // 转发请求到后端
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        
        // 如果连接成功，跳出循环
        response = resp;
        console.log(`成功连接到后端: ${url}, 状态码: ${resp.status}`);
        break;
      } catch (error: any) {
        lastError = error;
        console.error(`连接失败: ${url}, 错误:`, error);
      }
    }
    
    // 如果所有URL都连接失败
    if (!response) {
      console.error('所有后端地址连接失败');
      return res.status(500).json({ 
        message: '无法连接到后端服务',
        error: lastError?.message || '未知错误'
      });
    }
    
    // 获取响应内容
    const data = await response.json();
    
    // 返回后端响应
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('代理请求处理错误:', error);
    return res.status(500).json({ 
      message: '代理请求处理错误',
      error: error.message || '未知错误'
    });
  }
}
