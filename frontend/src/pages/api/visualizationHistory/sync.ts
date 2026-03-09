/**
 * 可视化历史同步API
 * 用于在新增问答对或图表配置时自动更新可视化历史集合
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Collection, ObjectId } from 'mongodb';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata';

// 集合名称
const MESSAGES_COLLECTION = 'messages';
const CHART_CONFIGS_COLLECTION = 'chart_configs';
// 使用query_history集合代替visualization_history集合
const VISUALIZATION_HISTORY_COLLECTION = 'query_history';

// 数据模型接口
interface VisualizationHistoryRecord {
  _id?: ObjectId;
  messageId: string;              // 与消息ID关联
  userQuestion: string;           // 用户提问
  assistantResponse: string;      // AI助手回复
  sqlQuery: string;               // SQL查询语句
  visualizationType: string;      // 可视化类型
  chartConfig: any;               // 图表配置
  createdAt: Date;                // 创建时间
  updatedAt: Date;                // 更新时间
}

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`不支持 ${req.method} 方法`);
  }

  try {
    console.log('开始同步可视化历史记录...');
    const { messageId, chartConfigId, sqlQuery } = req.body;
    
    // 必须提供至少一个标识
    if (!messageId && !chartConfigId && !sqlQuery) {
      return res.status(400).json({
        success: false,
        message: '请至少提供messageId、chartConfigId或sqlQuery其中之一'
      });
    }
    
    // 连接到所有必要的集合
    const messagesCollection = await connectToCollection(MESSAGES_COLLECTION);
    const chartConfigsCollection = await connectToCollection(CHART_CONFIGS_COLLECTION);
    const visualizationHistoryCollection = await connectToCollection(VISUALIZATION_HISTORY_COLLECTION);
    
    // 查询相关记录
    let message: any = null;
    let chartConfig: any = null;
    
    // 1. 查询消息记录
    if (messageId) {
      message = await messagesCollection.findOne({ messageId });
      if (!message) {
        console.log(`未找到messageId为 ${messageId} 的消息记录`);
      }
    }
    
    // 2. 如果没有找到消息，但有SQL查询，尝试通过SQL查询找到相关消息
    if (!message && sqlQuery) {
      // 尝试通过SQL查询内容查找消息
      message = await messagesCollection.findOne({
        content: { $regex: sqlQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: "i" }
      });
      if (!message) {
        console.log(`未找到包含SQL查询 ${sqlQuery.substring(0, 30)}... 的消息记录`);
      }
    }
    
    // 3. 查询图表配置
    if (chartConfigId) {
      chartConfig = await chartConfigsCollection.findOne({ _id: new ObjectId(chartConfigId) });
    } else if (messageId) {
      chartConfig = await chartConfigsCollection.findOne({ messageId });
    } else if (sqlQuery) {
      chartConfig = await chartConfigsCollection.findOne({
        sqlQuery: { $regex: sqlQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: "i" }
      });
    }
    
    if (!chartConfig) {
      console.log('未找到相关的图表配置');
    }
    
    // 如果没有找到消息或图表配置，则无法同步
    if (!message && !chartConfig) {
      return res.status(404).json({
        success: false,
        message: '未找到相关的消息记录或图表配置'
      });
    }
    
    // 提取SQL查询
    let extractedSqlQuery = sqlQuery || '';
    if (!extractedSqlQuery && message) {
      const content = message.content || '';
      
      // 尝试提取SQL查询
      const sqlMatches = content.match(/```sql([\s\S]*?)```/);
      if (sqlMatches && sqlMatches[1]) {
        extractedSqlQuery = sqlMatches[1].trim();
      } else {
        // 如果没有SQL代码块，尝试找出类似SQL的部分
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim().toUpperCase().startsWith('SELECT') || 
              line.trim().toUpperCase().startsWith('INSERT') ||
              line.trim().toUpperCase().startsWith('UPDATE') ||
              line.trim().toUpperCase().startsWith('DELETE')) {
            extractedSqlQuery = line.trim();
            break;
          }
        }
      }
    } else if (!extractedSqlQuery && chartConfig && chartConfig.sqlQuery) {
      extractedSqlQuery = chartConfig.sqlQuery;
    }
    
    // 如果没有提取到SQL查询，则无法同步
    if (!extractedSqlQuery) {
      return res.status(400).json({
        success: false,
        message: '未找到有效的SQL查询'
      });
    }
    
    // 查找用户问题
    let userQuestion = '';
    if (message && message.threadId) {
      const userMsg = await messagesCollection.findOne({
        threadId: message.threadId, 
        role: 'user',
        createdAt: { $lt: message.createdAt }
      }, { sort: { createdAt: -1 } });
      
      if (userMsg) {
        userQuestion = userMsg.content || '';
      }
    }
    
    // 准备可视化历史记录
    const visualizationRecord: VisualizationHistoryRecord = {
      messageId: (message && message.messageId) || (chartConfig && chartConfig.messageId) || `synthetic-${Date.now()}`,
      userQuestion: userQuestion,
      assistantResponse: (message && message.content) || '',
      sqlQuery: extractedSqlQuery,
      visualizationType: (chartConfig && chartConfig.visualization_type) || 'bar',
      chartConfig: (chartConfig && chartConfig.echartsConfig) || {},
      createdAt: (message && message.createdAt) || (chartConfig && chartConfig.createdAt) || new Date(),
      updatedAt: new Date()
    };
    
    // 查找是否已存在记录
    const existingRecordId = (message && message.messageId) ? 
      { messageId: message.messageId } : 
      { sqlQuery: extractedSqlQuery };
    
    const existingRecord = await visualizationHistoryCollection.findOne(existingRecordId);
    
    let result;
    if (existingRecord) {
      // 更新现有记录
      result = await visualizationHistoryCollection.updateOne(
        existingRecordId,
        { $set: visualizationRecord }
      );
      console.log(`已更新可视化历史记录，ID: ${existingRecord._id}`);
      
      return res.status(200).json({
        success: true,
        message: '可视化历史记录已更新',
        updated: true,
        created: false,
        recordId: existingRecord._id
      });
    } else {
      // 创建新记录
      result = await visualizationHistoryCollection.insertOne(visualizationRecord);
      console.log(`已创建新的可视化历史记录，ID: ${result.insertedId}`);
      
      return res.status(200).json({
        success: true,
        message: '已创建新的可视化历史记录',
        updated: false,
        created: true,
        recordId: result.insertedId
      });
    }
  } catch (error) {
    console.error('同步可视化历史记录时出错:', error);
    return res.status(500).json({
      success: false,
      message: '同步可视化历史记录时出错',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}
