// API端点用于清除所有记忆库和可视化历史数据
import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

// 响应类型
type ResponseData = {
  success: boolean;
  message: string;
  memoriesDeleted?: number;
  chartConfigsDeleted?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // 仅支持POST方法
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只支持POST方法' });
  }

  try {
    // 获取MongoDB连接字符串 - 从环境变量或使用默认值
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || 'chatbot_analysis';
    
    // 连接到MongoDB
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    
    // 记忆库集合 (Conversations)
    const conversationsCollection = db.collection('conversations');
    
    // 图表配置集合 (ChartConfigs)
    const chartConfigsCollection = db.collection('chart_configs');
    
    // 删除所有记忆库记录
    const memoriesResult = await conversationsCollection.deleteMany({});
    
    // 删除所有图表配置
    const chartConfigsResult = await chartConfigsCollection.deleteMany({});
    
    // 关闭数据库连接
    await client.close();
    
    // 返回成功结果
    return res.status(200).json({
      success: true,
      message: '所有记忆库和可视化历史数据已清除',
      memoriesDeleted: memoriesResult.deletedCount,
      chartConfigsDeleted: chartConfigsResult.deletedCount
    });
  } catch (error) {
    console.error('清除数据失败:', error);
    return res.status(500).json({
      success: false,
      message: '清除数据时发生错误',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}
