import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stardata';
const MONGODB_DB = process.env.MONGODB_DB || 'stardata';

// 连接到MongoDB数据库
async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  return { client, db };
}

interface ConversationDocument {
  _id: any;
  title?: string;
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  messages?: any[];
  message_count?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只允许GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只允许GET请求' });
  }

  try {
    // 获取limit参数，默认为3
    const limit = parseInt(req.query.limit as string) || 3;
    
    // 连接到MongoDB
    const { db } = await connectToDatabase();
    
    // 查询最近的对话
    const conversations = await db
      .collection('conversations')
      .find({})
      .sort({ updated_at: -1 }) // 按更新时间降序排序
      .limit(limit)
      .project({
        _id: 1,
        title: 1,
        user_id: 1,
        created_at: 1,
        updated_at: 1,
        message_count: { $size: { $ifNull: ["$messages", []] } } // 计算消息数量
      })
      .toArray();
    
    // 转换_id为字符串形式的id
    const formattedConversations = conversations.map((conv: any) => ({
      id: conv._id.toString(),
      title: conv.title || '新对话',
      userId: conv.user_id,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      messageCount: conv.message_count || 0
    }));
    
    return res.status(200).json({ 
      success: true, 
      data: formattedConversations 
    });
  } catch (error) {
    console.error('获取最近对话失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器错误，无法获取最近对话' 
    });
  }
}
