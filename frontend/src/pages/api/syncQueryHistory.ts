/**
 * 同步查询历史API
 * 用于确保问答对和图表配置实时同步到查询历史中
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Collection, ObjectId } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata'; // 使用stardata数据库

// 集合名称
const CHART_CONFIGS_COLLECTION = 'chart_configs';
const CONVERSATIONS_COLLECTION = 'conversations';
const QUERY_HISTORY_COLLECTION = 'query_history';

// 连接MongoDB并返回指定集合
async function connectToCollection(collectionName: string): Promise<Collection> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    
    // 检查集合是否存在，如果不存在则创建
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`集合 ${collectionName} 不存在，将自动创建`);
      await db.createCollection(collectionName);
      console.log(`集合 ${collectionName} 创建成功`);
      
      // 如果是query_history集合，创建索引
      if (collectionName === QUERY_HISTORY_COLLECTION) {
        await db.collection(collectionName).createIndex({ messageId: 1 }, { unique: true, sparse: true });
        await db.collection(collectionName).createIndex({ sql_query: 'text' });
        console.log(`为 ${collectionName} 集合创建索引成功`);
      }
    }
    
    return db.collection(collectionName);
  } catch (error) {
    console.error(`连接或创建集合 ${collectionName} 失败:`, error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      console.log('===== 开始同步查询历史 =====');
      const { messageId, sqlQuery } = req.query;
      const { user_question, sql_query, visualization_type, chart_config, messageId: bodyMessageId } = req.body;
      
      // 检查参数
      if ((!messageId && !sqlQuery) || !sql_query) {
        return res.status(400).json({ error: '需要提供messageId或sqlQuery参数以及sql_query内容' });
      }
      
      // 优先使用查询参数中的messageId，其次是请求体中的messageId
      const effectiveMessageId = (messageId as string) || bodyMessageId;
      
      // 获取MongoDB集合
      const chartConfigsCollection = await connectToCollection(CHART_CONFIGS_COLLECTION);
      const queryHistoryCollection = await connectToCollection(QUERY_HISTORY_COLLECTION);
      
      console.log(`开始同步查询历史: messageId=${effectiveMessageId || '无'}, sqlQuery长度=${sqlQuery?.length || sql_query.length}`);
      
      // 1. 首先检查问答对是否已经存在于查询历史中
      let existingRecord = null;
      if (effectiveMessageId) {
        existingRecord = await queryHistoryCollection.findOne({ messageId: effectiveMessageId });
        console.log(`根据messageId查询历史记录: ${existingRecord ? '找到记录' : '未找到记录'}`);
      }
      
      // 如果通过messageId没找到，则尝试通过sqlQuery查找
      if (!existingRecord && sql_query) {
        existingRecord = await queryHistoryCollection.findOne({ sql_query });
        console.log(`根据sqlQuery查询历史记录: ${existingRecord ? '找到记录' : '未找到记录'}`);
      }
      
      // 2. 如果记录不存在，则检查图表配置是否存在
      let chartConfig = null;
      if (!existingRecord) {
        if (effectiveMessageId) {
          chartConfig = await chartConfigsCollection.findOne({ messageId: effectiveMessageId });
          console.log(`根据messageId查询图表配置: ${chartConfig ? '找到配置' : '未找到配置'}`);
        }
        
        // 如果通过messageId没找到，则尝试通过sqlQuery查找
        if (!chartConfig && sql_query) {
          chartConfig = await chartConfigsCollection.findOne({ sqlQuery: sql_query });
          console.log(`根据sqlQuery查询图表配置: ${chartConfig ? '找到配置' : '未找到配置'}`);
        }
      }
      
      // 3. 准备要保存或更新的数据
      const now = new Date();
      const queryHistoryData = {
        user_question: user_question || '',
        sql_query: sql_query,
        visualization_type: visualization_type || 'bar',
        created_at: now,
        updated_at: now,
        has_visualization: !!chart_config,
        chart_config: chart_config || (chartConfig ? chartConfig.echartsConfig : null)
      };
      
      // 如果有messageId，添加到数据中
      if (effectiveMessageId) {
        Object.assign(queryHistoryData, { messageId: effectiveMessageId });
      }
      
      // 4. 保存或更新查询历史
      let result;
      if (existingRecord) {
        // 更新现有记录
        result = await queryHistoryCollection.updateOne(
          { _id: existingRecord._id },
          { $set: { 
            ...queryHistoryData,
            updated_at: now // 确保更新时间戳
          }}
        );
        console.log(`更新现有查询历史记录: ID=${existingRecord._id}, 修改数量=${result.modifiedCount}`);
      } else {
        // 创建新记录
        result = await queryHistoryCollection.insertOne(queryHistoryData);
        console.log(`创建新的查询历史记录: ID=${result.insertedId}`);
      }
      
      // 5. 如果记录存在但图表配置不存在，同时更新图表配置集合
      if (existingRecord && !existingRecord.chart_config && chart_config) {
        try {
          const chartConfigData = {
            sqlQuery: sql_query,
            echartsConfig: chart_config,
            messageId: effectiveMessageId,
            createdAt: now,
            updatedAt: now
          };
          
          await chartConfigsCollection.updateOne(
            effectiveMessageId ? { messageId: effectiveMessageId } : { sqlQuery: sql_query },
            { $set: chartConfigData },
            { upsert: true }
          );
          
          console.log('同时更新图表配置集合成功');
        } catch (error) {
          console.error('更新图表配置集合失败:', error);
        }
      }
      
      // 返回成功响应
      console.log('===== 查询历史同步完成 =====');
      return res.status(200).json({ 
        success: true, 
        message: existingRecord ? '查询历史记录已更新' : '新的查询历史记录已创建',
        updated: !!existingRecord,
        created: !existingRecord
      });
    } catch (error) {
      console.error('同步查询历史出错:', error);
      return res.status(500).json({ error: '服务器错误' });
    }
  } else {
    // 只支持POST请求
    return res.status(405).json({ error: '方法不允许' });
  }
}
