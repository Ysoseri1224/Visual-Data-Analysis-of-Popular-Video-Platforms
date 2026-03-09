import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Collection, ObjectId } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata'; // 使用stardata数据库而非chatbot_analysis

// 集合名称
const CHART_CONFIGS_COLLECTION = 'chart_configs';
const CONVERSATIONS_COLLECTION = 'conversations';

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
      
      // 如果是chart_configs集合，创建索引
      if (collectionName === CHART_CONFIGS_COLLECTION) {
        await db.collection(collectionName).createIndex({ messageId: 1 }, { unique: true, sparse: true });
        await db.collection(collectionName).createIndex({ sqlQuery: 1 });
        await db.collection(collectionName).createIndex({ visualization_type: 1 }); // 为可视化类型添加索引
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
  if (req.method === 'GET') {
    // 从MongoDB获取图表配置，支持按messageId或sqlQuery查询
    try {
      const { messageId, sqlQuery } = req.query;
      
      // 必须提供messageId或sqlQuery之一
      if (!messageId && !sqlQuery) {
        return res.status(400).json({ error: '需要提供messageId或sqlQuery参数' });
      }
      
      const chartConfigsCollection = await connectToCollection(CHART_CONFIGS_COLLECTION);
      let chartConfig;
      
      console.log(`开始查询图表配置API: messageId=${messageId}, sqlQuery长度=${sqlQuery?.length || 0}`);
      console.log(`已成功连接到 ${CHART_CONFIGS_COLLECTION} 集合`);
      
      // 打印当前数据库状态
      const totalCount = await chartConfigsCollection.countDocuments({});
      console.log(`数据库中共有 ${totalCount} 条图表配置记录`);
      
      // 如果是通过messageId查询
      if (messageId && typeof messageId === 'string') {
        console.log(`按messageId查询: ${messageId}`);
        
        // 先检查数据库中是否有任何数据
        const sample = await chartConfigsCollection.findOne({});
        console.log(`数据库中的第一条数据messageId示例（如果有）: ${sample?.messageId || '无数据'}`);
        
        // 尝试非精确查询，来查找是否有类似的messageId
        const regexPattern = new RegExp(messageId.replace(/[-\/\^$*+?.()|[\]{}]/g, '\$&'), 'i');
        const similarResults = await chartConfigsCollection.find({ messageId: { $regex: regexPattern } }).limit(5).toArray();
        
        if (similarResults.length > 0) {
          console.log(`找到与 ${messageId} 相似的 ${similarResults.length} 条记录:`);
          similarResults.forEach((item, index) => {
            console.log(`${index + 1}. messageId=${item.messageId}, createdAt=${new Date(item.createdAt).toLocaleString()}`);
          });
        } else {
          console.log(`没有找到与 ${messageId} 相似的记录`);
        }
        
        // 正常查询
        chartConfig = await chartConfigsCollection.findOne({ messageId });
        console.log(`messageId精确查询结果: ${chartConfig ? '找到数据' : '未找到数据'}`);
      } 
      // 如果没有messageId或通过messageId没找到，则按sqlQuery查询
      else if (sqlQuery && typeof sqlQuery === 'string') {
        console.log(`按sqlQuery查询，查询文本: ${sqlQuery.substring(0, 50)}...`);
        
        // 检查是否存在匹配的记录
        let existingConfig = null;
        
        // 如果有messageId，则优先使用messageId查询
        if (messageId) {
          console.log(`尝试使用messageId查询: ${messageId}`);
          
          // 先直接查询精确匹配
          existingConfig = await chartConfigsCollection.findOne({ messageId });
          console.log(`精确查询结果：${existingConfig ? '找到数据' : '未找到数据'}`);
          
          // 如果精确查询没有结果，尝试使用正则表达式查询
          if (!existingConfig) {
            try {
              // 遍历数据库中的所有数据，检查是否有类似的ID
              const allConfigs = await chartConfigsCollection.find({}).toArray();
              console.log(`数据库中共查询到 ${allConfigs.length} 条数据`);
              
              // 输出数据库中的所有messageId，方便调试
              if (allConfigs.length > 0) {
                console.log('数据库中的messageId列表:');
                allConfigs.forEach((config, index) => {
                  console.log(`${index + 1}. ${config.messageId || '无messageId'}`);
                });
              }
              
              // 尝试使用正则表达式进行模糊查询
              if (messageId) {
                const escapeRegExp = (string: string) => {
                  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                };
                
                // 确保messageId是字符串类型
                const messageIdStr = typeof messageId === 'string' ? messageId : String(messageId);
                const regexPattern = new RegExp(escapeRegExp(messageIdStr), 'i');
                console.log(`使用正则表达式查询: ${regexPattern}`);
                
                const regexResults = await chartConfigsCollection.find({ 
                  messageId: { $regex: regexPattern } 
                }).toArray();
                
                if (regexResults.length > 0) {
                  console.log(`正则表达式查询到 ${regexResults.length} 条结果`);
                  existingConfig = regexResults[0]; // 使用第一条匹配结果
                }
              }
            } catch (error) {
              console.error('在模糊查询过程中发生错误:', error);
            }
          }
        }
        
        // 如果通过messageId没找到，则使用sqlQuery查询
        if (!existingConfig) {
          existingConfig = await chartConfigsCollection.findOne({ sqlQuery });
          console.log(`根据sqlQuery查询结果：${existingConfig ? '找到数据' : '未找到数据'}`);
        }
        
        chartConfig = existingConfig;
      }
      
      if (chartConfig) {
        console.log(`找到图表配置，创建于: ${new Date(chartConfig.createdAt).toLocaleString()}`);
        console.log(`返回数据大小: ${JSON.stringify(chartConfig.echartsConfig).length} 字节`);
        return res.status(200).json({
          found: true,
          config: chartConfig.echartsConfig,
          messageId: chartConfig.messageId,
          visualization_type: chartConfig.visualization_type || 'bar',
          createdAt: chartConfig.createdAt
        });
      } else {
        console.log('未在数据库中找到任何图表配置缓存');
        return res.status(404).json({ found: false });
      }
    } catch (error) {
      console.error('获取图表配置出错:', error);
      return res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'POST') {
    // 存储图表配置到MongoDB
    try {
      console.log('====== 接收到POST请求，准备保存图表配置到MongoDB ======');
      const { sqlQuery, echartsConfig, messageId, userQuestion, source, visualization_type } = req.body;
      
      console.log(`请求参数: sqlQuery长度=${sqlQuery?.length || 0}, 有echartsConfig=${!!echartsConfig}, 有messageId=${!!messageId}, 有userQuestion=${!!userQuestion}, 来源=${source || '未指定'}, 可视化类型=${visualization_type || '未指定'}`);
      
      if (messageId) {
        console.log(`原始messageId: ${messageId}`);  
      }
      
      if (!sqlQuery || !echartsConfig) {
        console.error('缺少必需参数 sqlQuery 或 echartsConfig');
        return res.status(400).json({ error: '需要提供SQL查询和图表配置' });
      }
      
      console.log(`SQL查询: ${sqlQuery.substring(0, 100)}...`);
      console.log(`ECharts配置大小: ${JSON.stringify(echartsConfig).length} 字节`);
      
      const chartConfigsCollection = await connectToCollection(CHART_CONFIGS_COLLECTION);
      const conversationsCollection = await connectToCollection(CONVERSATIONS_COLLECTION);
      
      // 定义图表配置数据类型
      interface ChartConfigData {
        sqlQuery: string;
        echartsConfig: any;
        createdAt: Date;
        updatedAt: Date;
        messageId?: string; // 可选的messageId字段
        visualization_type?: string; // 新增：可视化类型字段，如 'bar', 'line', 'pie', 'doughnut' 等
      }
      
      // 准备要存储的图表配置数据
      const chartConfigData: ChartConfigData = {
        sqlQuery,
        echartsConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
        visualization_type: visualization_type || 'bar' // 默认使用柱状图类型
      };
      
      // 记录日志确认visualization_type字段被设置
      console.log(`将保存的可视化类型: ${chartConfigData.visualization_type}`);
      
      // 如果提供了messageId，先查询确认消息存在
      if (messageId) {
        try {
          // 尝试将messageId转换为ObjectId（如果MongoDB使用ObjectId作为主键）
          const query = typeof messageId === 'string' && messageId.length === 24 
            ? { _id: new ObjectId(messageId) } 
            : { id: messageId };
            
          const message = await conversationsCollection.findOne(query);
          
          if (message) {
            // 如果消息存在，将messageId关联到图表配置
            Object.assign(chartConfigData, { messageId });
            
            // 更新消息，将echarts_config标记添加到消息中
            await conversationsCollection.updateOne(
              query,
              { 
                $set: { 
                  has_visualization: true,
                  visualization_type: 'echarts',
                  updated_at: new Date()
                } 
              }
            );
          }
        } catch (err) {
          console.warn('查询或更新消息失败:', err);
          // 继续执行，即使我们无法关联消息
        }
      } else if (userQuestion) {
        // 如果没有提供messageId但提供了用户问题，尝试创建新的对话记录
        try {
          const conversationData = {
            user_question: userQuestion,
            system_answer: sqlQuery,
            has_visualization: true,
            visualization_type: 'echarts',
            created_at: new Date(),
            updated_at: new Date()
          };
          
          const result = await conversationsCollection.insertOne(conversationData);
          if (result.insertedId) {
            // 将新创建的对话ID关联到图表配置
            Object.assign(chartConfigData, { messageId: result.insertedId.toString() });
          }
        } catch (err) {
          console.warn('创建新对话记录失败:', err);
          // 继续执行，即使我们无法创建对话记录
        }
      }
      
      // 保存图表配置
      // 如果有messageId，使用它作为唯一标识符；否则使用sqlQuery
      const query = chartConfigData.messageId ? { messageId: chartConfigData.messageId } : { sqlQuery };
      console.log(`更新/插入条件:`, query);
      console.log(`将保存的数据:`, {
        sqlQueryLength: chartConfigData.sqlQuery.length,
        hasEchartsConfig: !!chartConfigData.echartsConfig,
        hasMessageId: !!chartConfigData.messageId,
        createdAt: chartConfigData.createdAt,
        updatedAt: chartConfigData.updatedAt
      });
      
      try {
        // 先检查记录是否存在
        const existingRecord = await chartConfigsCollection.findOne(query);
        console.log(`检查现有记录: ${existingRecord ? '找到现有记录' : '未找到记录，将创建新的'}`);
        
        // 执行更新或插入
        const updateResult = await chartConfigsCollection.updateOne(
          query,
          { $set: chartConfigData },
          { upsert: true }
        );
        
        console.log(`数据库操作结果: 修改记录数=${updateResult.modifiedCount}, 插入记录数=${updateResult.upsertedCount}, 匹配记录数=${updateResult.matchedCount}`);
        
        if (updateResult.upsertedId) {
          console.log(`创建了新的记录，ID: ${updateResult.upsertedId.toString()}`);
        }
        
        // 执行再次查询确认数据已存在
        const savedRecord = await chartConfigsCollection.findOne(query);
        console.log(`再次检查确认数据已${savedRecord ? '成功保存' : '存储失败!'}`);
        
        return res.status(200).json({ 
          success: true,
          messageId: chartConfigData.messageId,
          visualization_type: chartConfigData.visualization_type,
          updated: updateResult.modifiedCount > 0,
          created: updateResult.upsertedCount > 0,
          matchedCount: updateResult.matchedCount,
          hasVerifiedSave: !!savedRecord
        });
      } catch (dbError) {
        console.error(`保存到数据库时发生错误:`, dbError);
        throw dbError;
      }
    } catch (error) {
      console.error('存储图表配置出错:', error);
      return res.status(500).json({ error: '服务器错误' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`不支持 ${req.method} 方法`);
  }
}
