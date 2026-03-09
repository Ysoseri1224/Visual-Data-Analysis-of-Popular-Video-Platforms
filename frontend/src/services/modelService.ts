/**
 * 模型服务
 * 提供对不同模型的调用接口，包括记忆库、T5模型和DeepSeek API
 */

import axios from 'axios';
import deepseekService from './deepseekService';

// 获取API地址
// 优先使用环境变量，否则使用默认值
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// DeepSeek API密钥
const DEEPSEEK_API_KEY = 'sk-78df017dca4e4db896f23be28c435e61';

// 消息接口
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sqlQuery?: string;
}

// 模拟T5模型准确率低的SQL生成结果
const generateInaccurateSQL = (originalSQL: string): string => {
  // 引入常见错误类型的随机选择
  const errorTypes = [
    'syntax', // 语法错误
    'table',  // 表名错误
    'column', // 列名错误
    'join',   // 连接错误
    'where',  // 条件错误
    'order',  // 排序错误
    'none'    // 无错误
  ];
  
  // 随机选择1-2个错误类型
  const numErrors = Math.floor(Math.random() * 2) + 1;
  const selectedErrors: string[] = [];
  for (let i = 0; i < numErrors; i++) {
    const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    if (!selectedErrors.includes(errorType) && errorType !== 'none') {
      selectedErrors.push(errorType);
    }
  }
  
  // 如果随机选择了'none'或没有选择错误，返回原始SQL
  if (selectedErrors.length === 0) {
    return originalSQL;
  }
  
  let modifiedSQL = originalSQL;
  
  // 应用选择的错误类型
  for (const errorType of selectedErrors) {
    switch (errorType) {
      case 'syntax':
        // 添加语法错误，如缺少分号、括号不匹配等
        const syntaxErrors = [
          () => modifiedSQL.replace(';', ''),  // 移除分号
          () => modifiedSQL.replace('FROM', 'FORM'),  // 拼写错误
          () => modifiedSQL.replace('WHERE', 'WHER'),  // 拼写错误
          () => modifiedSQL + ' ORDER BYY',  // 添加错误的ORDER BY
        ];
        modifiedSQL = syntaxErrors[Math.floor(Math.random() * syntaxErrors.length)]();
        break;
        
      case 'table':
        // 表名错误
        if (modifiedSQL.includes('FROM')) {
          const randomSuffix = Math.random().toString(36).substring(2, 5);
          modifiedSQL = modifiedSQL.replace(/FROM\s+([\w\`\.]+)/i, (match, tableName) => {
            return `FROM ${tableName}_${randomSuffix}`;
          });
        }
        break;
        
      case 'column':
        // 列名错误
        if (modifiedSQL.includes('SELECT')) {
          // 在SELECT子句中随机修改一个列名
          const randomSuffix = Math.random().toString(36).substring(2, 5);
          modifiedSQL = modifiedSQL.replace(/SELECT\s+(.+?)\s+FROM/i, (match, columns) => {
            const columnList = columns.split(',');
            if (columnList.length > 0) {
              const randomIndex = Math.floor(Math.random() * columnList.length);
              columnList[randomIndex] = columnList[randomIndex] + '_' + randomSuffix;
            }
            return `SELECT ${columnList.join(',')} FROM`;
          });
        }
        break;
        
      case 'where':
        // WHERE条件错误
        if (modifiedSQL.includes('WHERE')) {
          const whereErrors = [
            () => modifiedSQL.replace(/WHERE\s+(.+?)(?=(ORDER BY|GROUP BY|LIMIT|;|$))/i, 'WHERE 1=1'),  // 替换为无效条件
            () => modifiedSQL.replace(/WHERE\s+(.+?)(?=(ORDER BY|GROUP BY|LIMIT|;|$))/i, 'WHERE false'),  // 替换为总是返回空的条件
            () => modifiedSQL.replace(/WHERE\s+(.+?)(?=(ORDER BY|GROUP BY|LIMIT|;|$))/i, (match, condition) => {
              return `WHERE ${condition} AND nonexistent_column = 'value'`;
            }),  // 添加不存在的列
          ];
          modifiedSQL = whereErrors[Math.floor(Math.random() * whereErrors.length)]();
        }
        break;
        
      case 'order':
        // ORDER BY错误
        if (modifiedSQL.includes('ORDER BY')) {
          modifiedSQL = modifiedSQL.replace(/ORDER BY\s+(.+?)(?=(LIMIT|;|$))/i, 'ORDER BY invalid_column');
        } else if (!modifiedSQL.includes('ORDER BY') && Math.random() > 0.5) {
          // 随机添加ORDER BY
          modifiedSQL = modifiedSQL.replace(/(;|$)/, ' ORDER BY random_column$1');
        }
        break;
    }
  }
  
  return modifiedSQL;
};

// 调用本地T5模型生成SQL（实际上使用DeepSeek但模拟T5准确率）
export const generateSqlWithT5 = async (messages: Message[]): Promise<{
  content: string;
  sqlQuery: string;
}> => {
  try {
    console.log('调用T5模型生成SQL（实际上使用DeepSeek但模拟T5准确率）...');
    
    // 使用DeepSeek API获取高质量SQL
    const apiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const systemPrompt = 'You are a database expert. Generate SQL statements based on user descriptions. Provide explanations and SQL code wrapped in ```sql ... ```.';
    
    // 调用DeepSeek API获取高质量结果
    const response = await deepseekService.sendChatRequest({
      messages: apiMessages,
      systemPrompt: systemPrompt
    });
    
    // 从响应中提取SQL查询语句
    const responseContent = response.content;
    let sqlQuery = '';
    let explanation = responseContent;
    
    // 使用正则表达式提取SQL语句
    const sqlRegex = /```sql([\s\S]*?)```/;
    const match = responseContent.match(sqlRegex);
    
    if (match && match[1]) {
      sqlQuery = match[1].trim();
      // 将解释中的SQL代码块移除
      explanation = responseContent.replace(sqlRegex, '').trim();
    }
    
    // 随机决定是否降低准确率（约50%的概率）
    const shouldReduceAccuracy = Math.random() < 0.5;
    
    if (shouldReduceAccuracy && sqlQuery) {
      // 降低SQL准确率
      const inaccurateSql = generateInaccurateSQL(sqlQuery);
      
      // 根据错误SQL生成相应的解释文本
      const errorExplanation = '我尝试根据您的描述生成SQL，但我可能对某些表名或字段有些混淆。请检查SQL语法是否正确。';
      
      return {
        content: errorExplanation,
        sqlQuery: inaccurateSql
      };
    }
    
    return {
      content: explanation || '我已根据您的描述生成了SQL查询语句。',
      sqlQuery: sqlQuery || ''
    };
  } catch (error) {
    console.error('T5模型调用失败:', error);
    
    // 模拟生成的SQL和解释（当T5模型调用失败时）
    return {
      content: '我生成了一个基本的SQL查询语句来获取用户数据。注意这是模拟结果，因为T5模型调用失败。',
      sqlQuery: 'SELECT user_id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 10;'
    };
  }
};

// 调用DeepSeek API生成SQL
export const generateSqlWithDeepseek = async (messages: Message[]): Promise<{
  content: string;
  sqlQuery: string;
}> => {
  try {
    console.log('调用DeepSeek API生成SQL...');
    
    // 将消息格式转换为DeepSeek API格式
    const apiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // 添加系统提示，要求模型生成SQL
    const systemPrompt = 'You are a database expert. Generate SQL statements based on user descriptions. Provide explanations and SQL code wrapped in ```sql ... ```.';
    
    // 调用DeepSeek API
    const response = await deepseekService.sendChatRequest({
      messages: apiMessages,
      systemPrompt: systemPrompt
    });
    
    // 从响应中提取SQL查询语句
    const responseContent = response.content;
    let sqlQuery = '';
    let explanation = responseContent;
    
    // 使用正则表达式提取SQL语句
    const sqlRegex = /```sql([\s\S]*?)```/;
    const match = responseContent.match(sqlRegex);
    
    if (match && match[1]) {
      sqlQuery = match[1].trim();
      // 将解释中的SQL代码块移除
      explanation = responseContent.replace(sqlRegex, '').trim();
    }
    
    return {
      content: explanation,
      sqlQuery: sqlQuery
    };
  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    
    // 出错时返回错误信息
    return {
      content: `DeepSeek API调用出错: ${error instanceof Error ? error.message : '未知错误'}`,
      sqlQuery: ''
    };
  }
};

// 从本地记忆库匹配结果
export const matchFromMemory = async (query: string): Promise<{
  matched: boolean;
  content?: string;
  sqlQuery?: string;
}> => {
  try {
    console.log('从本地记忆库匹配回答...');
    
    // 使用硬编码的本地记忆库数据
    // 实际应用中可以使用返回正确路径的方法
    const memoryData = [
      {
        "question": "查询bilibili_video的所有数据",
        "query": "SELECT * FROM `bilibili_video`"
      },
      {
        "question": "获取bilibili_video中id为1的记录",
        "query": "SELECT * FROM `bilibili_video` WHERE id = 1"
      },
      {
        "question": "查询最近一周的bilibili_video数据",
        "query": "SELECT * FROM `bilibili_video` WHERE create_time > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))"
      },
      {
        "question": "查询bilibili_video按liked_count降序排列的前10条记录",
        "query": "SELECT * FROM `bilibili_video` ORDER BY liked_count DESC LIMIT 10"
      },
      {
        "question": "统计每个用户发布的视频数量",
        "query": "SELECT user_id, nickname, COUNT(*) as video_count FROM bilibili_video GROUP BY user_id, nickname ORDER BY video_count DESC"
      }
    ];
    
    // 简单的模糊匹配算法
    const normalizedQuery = query.toLowerCase().trim();
    
    for (const item of memoryData) {
      const normalizedQuestion = item.question.toLowerCase().trim();
      
      // 检查查询是否匹配问题关键词
      if (normalizedQuery.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedQuery)) {
        return {
          matched: true,
          content: `根据您的查询，我找到了相关的SQL语句：

${item.query}

该SQL实现了“${item.question}”的功能。`,
          sqlQuery: item.query
        };
      }
    }
    
    return { matched: false };
  } catch (error) {
    console.error('本地记忆库匹配出错:', error);
    return { matched: false };
  }
};



const modelService = {
  generateSqlWithT5,
  generateSqlWithDeepseek,
  matchFromMemory
};

export default modelService;
