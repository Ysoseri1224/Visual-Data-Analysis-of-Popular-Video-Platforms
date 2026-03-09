import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stardata'; // 使用stardata数据库
const CHART_CONFIGS_COLLECTION = 'chart_configs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`不支持 ${req.method} 方法`);
  }

  try {
    console.log('开始初始化 chart_configs 集合...');
    
    // 连接到MongoDB
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    console.log(`成功连接到数据库 ${DB_NAME}`);
    
    // 检查集合是否存在
    const collections = await db.listCollections({ name: CHART_CONFIGS_COLLECTION }).toArray();
    const collectionExists = collections.length > 0;
    
    // 根据情况处理集合
    if (collectionExists) {
      console.log(`集合 ${CHART_CONFIGS_COLLECTION} 已存在`);
      
      // 如果请求中要求强制重建索引
      if (req.body.force) {
        console.log('根据请求，重建索引');
        try {
          // 删除所有现有索引
          await db.collection(CHART_CONFIGS_COLLECTION).dropIndexes();
          console.log('已删除所有现有索引');
          
          // 创建新索引
          await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ messageId: 1 }, { unique: true, sparse: true });
          await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ sqlQuery: 1 });
          await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ visualization_type: 1 });
          console.log('已重建索引，包括新增的visualization_type索引');
        } catch (indexError) {
          console.error('重建索引时出错:', indexError);
        }
      }
      
      // 统计集合中的文档数量
      const count = await db.collection(CHART_CONFIGS_COLLECTION).countDocuments();
      console.log(`集合 ${CHART_CONFIGS_COLLECTION} 中有 ${count} 条记录`);
      
      // 为现有记录添加visualization_type字段（如果不存在）
      if (req.body.updateExistingRecords || req.body.force) {
        console.log('正在为现有记录添加visualization_type字段...');
        try {
          // 查询所有没有visualization_type字段的记录
          const recordsWithoutVisualizationType = await db.collection(CHART_CONFIGS_COLLECTION)
            .find({ visualization_type: { $exists: false } })
            .toArray();
            
          console.log(`找到 ${recordsWithoutVisualizationType.length} 条缺少visualization_type字段的记录`);
          
          if (recordsWithoutVisualizationType.length > 0) {
            // 批量更新这些记录
            const updateResult = await db.collection(CHART_CONFIGS_COLLECTION).updateMany(
              { visualization_type: { $exists: false } },
              { $set: { visualization_type: 'bar' } } // 默认使用柱状图
            );
            
            console.log(`已更新 ${updateResult.modifiedCount} 条记录，添加visualization_type字段`);
          }
        } catch (updateError) {
          console.error('更新现有记录时出错:', updateError);
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `集合 ${CHART_CONFIGS_COLLECTION} 已存在，包含 ${count} 条记录`,
        created: false,
        exists: true,
        count
      });
    } else {
      // 创建集合
      await db.createCollection(CHART_CONFIGS_COLLECTION);
      console.log(`已成功创建集合 ${CHART_CONFIGS_COLLECTION}`);
      
      // 创建索引
      await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ messageId: 1 }, { unique: true, sparse: true });
      await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ sqlQuery: 1 });
      await db.collection(CHART_CONFIGS_COLLECTION).createIndex({ visualization_type: 1 });
      console.log(`为 ${CHART_CONFIGS_COLLECTION} 创建索引成功，包括 visualization_type 字段`);
      
      // 插入一条测试数据
      const testData = {
        messageId: "test_init_id",
        sqlQuery: "SELECT * FROM test_table LIMIT 5",
        echartsConfig: {
          title: { text: "测试图表数据" },
          xAxis: { type: "category", data: ["测试1", "测试2", "测试3"] },
          yAxis: { type: "value" },
          series: [{ data: [10, 20, 30], type: "bar" }]
        },
        visualization_type: "bar", // 添加可视化类型字段
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "init_api"
      };
      
      await db.collection(CHART_CONFIGS_COLLECTION).insertOne(testData);
      console.log('已插入测试数据');
      
      return res.status(200).json({ 
        success: true, 
        message: `成功创建集合 ${CHART_CONFIGS_COLLECTION} 并设置索引`,
        created: true,
        exists: false,
        count: 1
      });
    }
  } catch (error: any) {
    console.error('初始化集合出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: `初始化集合出错: ${error?.message || '未知错误'}`,
      details: String(error)
    });
  }
}
