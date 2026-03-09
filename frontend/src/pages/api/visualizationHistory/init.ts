/**
 * 初始化和维护可视化历史集合
 * 该集合整合了messages集合中的问答对和chart_configs集合中的图表配置
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
    
    // 检查集合是否存在，不存在则创建
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`集合 ${collectionName} 不存在，将自动创建`);
      await db.createCollection(collectionName);
      console.log(`集合 ${collectionName} 创建成功`);
      
      // 如果是visualization_history集合，创建索引
      if (collectionName === VISUALIZATION_HISTORY_COLLECTION) {
        await db.collection(collectionName).createIndex({ messageId: 1 }, { unique: true });
        await db.collection(collectionName).createIndex({ sqlQuery: 'text' });
        await db.collection(collectionName).createIndex({ createdAt: -1 }); // 按创建时间倒序索引
        console.log(`为 ${collectionName} 集合创建索引成功`);
      }
    }
    
    return db.collection(collectionName);
  } catch (error) {
    console.error(`连接或创建集合 ${collectionName} 失败:`, error);
    throw error;
  }
}

// 聚合数据并更新可视化历史集合
async function aggregateAndUpdateVisualizationHistory() {
  try {
    // 连接到各个集合
    const messagesCollection = await connectToCollection(MESSAGES_COLLECTION);
    const chartConfigsCollection = await connectToCollection(CHART_CONFIGS_COLLECTION);
    const visualizationHistoryCollection = await connectToCollection(VISUALIZATION_HISTORY_COLLECTION);
    
    console.log('已连接到所有必要的集合');
    
    // 获取所有包含SQL查询的消息
    const messages = await messagesCollection.find({
      $or: [
        { "content": { $regex: "SELECT", $options: "i" } },
        { "content": { $regex: "INSERT", $options: "i" } },
        { "content": { $regex: "UPDATE", $options: "i" } },
        { "content": { $regex: "DELETE", $options: "i" } }
      ]
    }).toArray();
    
    console.log(`找到 ${messages.length} 条包含SQL的消息`);
    
    // 获取所有图表配置
    const chartConfigs = await chartConfigsCollection.find({}).toArray();
    console.log(`找到 ${chartConfigs.length} 条图表配置`);
    
    // 处理每一个消息
    let updatedCount = 0;
    let createdCount = 0;
    
    for (const message of messages) {
      // 尝试找到对应的问答对
      if (!message.messageId) continue;
      
      try {
        // 提取SQL查询
        let sqlQuery = '';
        const content = message.content || '';
        
        // 尝试提取SQL查询
        const sqlMatches = content.match(/```sql([\s\S]*?)```/);
        if (sqlMatches && sqlMatches[1]) {
          sqlQuery = sqlMatches[1].trim();
        } else {
          // 如果没有SQL代码块，尝试找出类似SQL的部分
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.trim().toUpperCase().startsWith('SELECT') || 
                line.trim().toUpperCase().startsWith('INSERT') ||
                line.trim().toUpperCase().startsWith('UPDATE') ||
                line.trim().toUpperCase().startsWith('DELETE')) {
              sqlQuery = line.trim();
              break;
            }
          }
        }
        
        if (!sqlQuery) continue;
        
        // 查找用户问题（上一条消息）
        let userQuestion = '';
        if (message.threadId) {
          const userMsg = await messagesCollection.findOne({
            threadId: message.threadId, 
            role: 'user',
            createdAt: { $lt: message.createdAt }
          }, { sort: { createdAt: -1 } });
          
          if (userMsg) {
            userQuestion = userMsg.content || '';
          }
        }
        
        // 查找对应的图表配置
        const chartConfig = chartConfigs.find(config => 
          (config.messageId && config.messageId === message.messageId) || 
          (config.sqlQuery && sqlQuery.includes(config.sqlQuery))
        );
        
        // 如果找到图表配置，创建或更新记录
        if (chartConfig) {
          const visualizationRecord: VisualizationHistoryRecord = {
            messageId: message.messageId,
            userQuestion: userQuestion,
            assistantResponse: message.content || '',
            sqlQuery: sqlQuery,
            visualizationType: chartConfig.visualization_type || 'bar',
            chartConfig: chartConfig.echartsConfig || {},
            createdAt: message.createdAt || new Date(),
            updatedAt: new Date()
          };
          
          // 查找是否已存在记录
          const existingRecord = await visualizationHistoryCollection.findOne({ 
            messageId: message.messageId 
          });
          
          if (existingRecord) {
            // 更新已存在的记录
            await visualizationHistoryCollection.updateOne(
              { messageId: message.messageId },
              { $set: visualizationRecord }
            );
            updatedCount++;
          } else {
            // 创建新记录
            await visualizationHistoryCollection.insertOne(visualizationRecord);
            createdCount++;
          }
        }
      } catch (error) {
        console.error(`处理消息 ${message.messageId} 时出错:`, error);
      }
    }
    
    console.log(`完成数据聚合和更新。创建了 ${createdCount} 条新记录，更新了 ${updatedCount} 条记录。`);
    return { createdCount, updatedCount };
  } catch (error) {
    console.error('聚合和更新可视化历史时出错:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`不支持 ${req.method} 方法`);
  }

  try {
    console.log('开始初始化和更新可视化历史集合...');
    
    // 执行数据聚合和更新
    const result = await aggregateAndUpdateVisualizationHistory();
    
    return res.status(200).json({
      success: true,
      message: '可视化历史集合已更新',
      created: result.createdCount,
      updated: result.updatedCount
    });
  } catch (error) {
    console.error('初始化可视化历史集合时出错:', error);
    return res.status(500).json({
      success: false,
      message: '初始化可视化历史集合时出错',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}
