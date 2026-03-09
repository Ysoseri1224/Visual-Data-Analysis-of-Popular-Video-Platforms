/**
 * SQL修正服务
 * 提供SQL查询的智能修正功能
 */

import { getAllValidTableNames, getAllValidColumnNames, getValidColumnNamesForTable } from '@/config/database-schema';
import databasePrompt from '@/config/database-schema';

// 用于DeepSeek API请求的接口
interface DeepSeekRequestBody {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
  top_p: number;
}

/**
 * 通过DeepSeek API获取SQL修正建议
 * @param sql 原始SQL语句
 * @param invalidColumns 检测到的无效列名
 * @param invalidTables 检测到的无效表名
 * @returns 修正建议文本
 */
export const getSqlCorrectionSuggestion = async (
  sql: string,
  invalidColumns: string[],
  invalidTables: string[]
): Promise<string> => {
  try {
    // 获取数据库结构和提示词
    const { schema, guidelines } = databasePrompt;
    const databaseSchemaJSON = JSON.stringify(schema, null, 2);
    const validTables = getAllValidTableNames();
    const validColumns = getAllValidColumnNames();
    
    // 构建提示词
    const prompt = `我有一个SQL查询需要修正。请根据以下数据库结构，帮我找出并修正SQL查询中的错误。
    
数据库结构信息:
${databaseSchemaJSON}

${guidelines}

我的SQL查询:
${sql}

检测到的问题:
${invalidTables.length > 0 ? `- 无效的表名: ${invalidTables.join(', ')}` : ''}
${invalidColumns.length > 0 ? `- 可能无效的列名: ${invalidColumns.join(', ')}` : ''}

有效的表名列表:
${validTables.join(', ')}

有效的列名列表(全部表):
${validColumns.join(', ')}

请直接返回修正后的SQL查询，不要有任何解释或其他内容。只需要返回纯文本的SQL语句，不需要代码块或其他格式。如果原始SQL没有错误，则原样返回。`;

    // 获取DeepSeek API密钥
    // 首先尝试从环境变量获取
    let apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    
    // 如果环境变量中没有，尝试从服务器获取
    if (!apiKey) {
      try {
        console.log('尝试从服务器获取DeepSeek API密钥...');
        const keyResponse = await fetch('/api/getDeepseekApiKey');
        if (keyResponse.ok) {
          const apiKeyText = await keyResponse.text();
          apiKey = apiKeyText.trim();
          console.log('已从服务器获取DeepSeek API密钥');
        } else {
          console.error('获取API密钥响应有误:', keyResponse.status, keyResponse.statusText);
        }
      } catch (keyError) {
        console.error('获取DeepSeek API密钥失败:', keyError);
      }
    }
    
    // 如果上述方法都失败，使用硬编码的备用密钥
    if (!apiKey) {
      apiKey = 'sk-7a57e3ba6a1b48cf9d4ed7e7ea1bbce5';
      console.log('使用硬编码的DeepSeek API密钥');
    }
    
    // 构建DeepSeek API请求
    const requestBody: DeepSeekRequestBody = {
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // 较低的温度以获得更确定的回答
      max_tokens: 2000,
      top_p: 1
    };
    
    // 发送请求到DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API响应错误: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // 解析响应
    const data = await response.json();
    
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      // 获取原始响应
      const content = data.choices[0].message.content;
      // 清理可能的代码块标记和额外文本
      let correctedSql = content;
      
      // 如果返回的是代码块，提取SQL语句
      const codeBlockMatch = content.match(/```(?:sql)?([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        correctedSql = codeBlockMatch[1].trim();
      }
      
      // 如果有多行文本，尝试提取单独的SQL语句行
      if (correctedSql.includes('\n')) {
        // 找到最长的非空行，这可能是SQL语句
        const lines = correctedSql.split('\n').filter((line: string) => line.trim().length > 0);
        if (lines.length > 0) {
          const sqlLines = lines.filter((line: string) => 
            line.toUpperCase().includes('SELECT') || 
            line.toUpperCase().includes('FROM') || 
            line.toUpperCase().includes('WHERE')
          );
          if (sqlLines.length > 0) {
            // 使用最长的可能是SQL的行
            correctedSql = sqlLines.sort((a: string, b: string) => b.length - a.length)[0];
          } else {
            // 如果没有包含SQL关键字的行，使用最长的行
            correctedSql = lines.sort((a: string, b: string) => b.length - a.length)[0];
          }
        }
      }
      
      console.log('原始DeepSeek响应:', content);
      console.log('提取的SQL语句:', correctedSql);
      
      return correctedSql;
    } else {
      throw new Error('DeepSeek API返回的数据格式不正确');
    }
    
  } catch (error) {
    console.error('获取SQL修正建议失败:', error);
    return `无法获取智能修正建议: ${error instanceof Error ? error.message : '未知错误'}。请尝试手动修正SQL语句。`;
  }
};
