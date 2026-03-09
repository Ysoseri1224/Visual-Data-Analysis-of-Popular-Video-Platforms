import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata';

// 集合名称
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
const CHART_CONFIGS_COLLECTION = 'chart_configs';
const QUERY_HISTORY_COLLECTION = 'visual_query_history'; // 可视化查询历史集合

// 数据统计接口的响应类型
type StatisticsResponse = {
  totalConversations: number;
  totalMessages: number;
  totalQueries: number;
  successfulQueriesRate: number;
  successfulQueries: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatisticsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      totalConversations: 0,
      totalMessages: 0,
      totalQueries: 0,
      successfulQueriesRate: 0,
      successfulQueries: 0,
      error: '只支持GET请求'
    });
  }

  let client;
  try {
    // 连接到MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    
    // 1. 总对话数：获取conversations集合中的总记录数
    const totalConversations = await db.collection(CONVERSATIONS_COLLECTION).countDocuments();
    
    // 2. 活跃对话数改为总会话数：获取messages集合中的总记录数
    const totalMessages = await db.collection(MESSAGES_COLLECTION).countDocuments();
    
    // 3. 查询总数：获取messages集合中 role 为 assistant 的记录数
    const totalQueries = await db.collection(MESSAGES_COLLECTION).countDocuments({ role: 'assistant' });
    
    // 4. 成功查询数：获取chart_config中的记录数
    const successfulQueries = await db.collection(CHART_CONFIGS_COLLECTION).countDocuments();
    
    // 5. 计算成功查询率：chart_config记录数 ÷ 可视化查询历史条数
    const successfulQueriesRate = totalQueries > 0 
      ? Math.round((successfulQueries / totalQueries) * 100) / 100
      : 0;
    
    // 返回统计数据
    return res.status(200).json({
      totalConversations,
      totalMessages,
      totalQueries,
      successfulQueriesRate,
      successfulQueries
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return res.status(500).json({
      totalConversations: 0,
      totalMessages: 0,
      totalQueries: 0,
      successfulQueriesRate: 0,
      successfulQueries: 0,
      error: '获取统计数据失败'
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
