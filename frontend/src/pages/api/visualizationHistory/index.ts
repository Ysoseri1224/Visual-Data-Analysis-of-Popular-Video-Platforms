/**
 * 可视化历史API端点
 * 用于查询和管理可视化历史记录
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Collection } from 'mongodb';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata';
// 使用query_history集合代替visualization_history集合
const VISUALIZATION_HISTORY_COLLECTION = 'query_history';

// 连接到MongoDB并返回指定集合
async function connectToCollection(collectionName: string): Promise<Collection> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    return db.collection(collectionName);
  } catch (error) {
    console.error(`连接到集合 ${collectionName} 失败:`, error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 根据请求方法处理不同操作
  switch (req.method) {
    case 'GET':
      return await getVisualizationHistory(req, res);
    case 'DELETE':
      return await deleteVisualizationHistory(req, res);
    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      return res.status(405).end(`不支持 ${req.method} 方法`);
  }
}

// 获取可视化历史记录
async function getVisualizationHistory(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messageId, limit = '10', skip = '0' } = req.query;
    const collection = await connectToCollection(VISUALIZATION_HISTORY_COLLECTION);
    
    // 如果提供了messageId，查询特定记录
    if (messageId) {
      const record = await collection.findOne({ messageId });
      if (!record) {
        return res.status(404).json({
          success: false,
          message: '未找到指定的可视化历史记录'
        });
      }
      return res.status(200).json({
        success: true,
        data: record
      });
    }
    
    // 否则返回所有记录（带分页）
    const limitNum = parseInt(limit as string);
    const skipNum = parseInt(skip as string);
    
    // 查询记录总数
    const total = await collection.countDocuments();
    
    // 查询记录（按创建时间倒序）
    const records = await collection.find({})
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .toArray();
    
    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        limit: limitNum,
        skip: skipNum
      }
    });
  } catch (error) {
    console.error('获取可视化历史记录时出错:', error);
    return res.status(500).json({
      success: false,
      message: '获取可视化历史记录时出错',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}

// 删除可视化历史记录
async function deleteVisualizationHistory(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messageId } = req.query;
    const collection = await connectToCollection(VISUALIZATION_HISTORY_COLLECTION);
    
    // 如果提供了messageId，删除特定记录
    if (messageId) {
      const result = await collection.deleteOne({ messageId });
      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: '未找到指定的可视化历史记录'
        });
      }
      return res.status(200).json({
        success: true,
        message: '可视化历史记录已删除'
      });
    }
    
    // 如果请求体中有deleteAll=true，删除所有记录
    if (req.body && req.body.deleteAll) {
      const result = await collection.deleteMany({});
      return res.status(200).json({
        success: true,
        message: `已删除所有可视化历史记录（共${result.deletedCount}条）`
      });
    }
    
    return res.status(400).json({
      success: false,
      message: '请提供messageId或设置deleteAll=true'
    });
  } catch (error) {
    console.error('删除可视化历史记录时出错:', error);
    return res.status(500).json({
      success: false,
      message: '删除可视化历史记录时出错',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}
