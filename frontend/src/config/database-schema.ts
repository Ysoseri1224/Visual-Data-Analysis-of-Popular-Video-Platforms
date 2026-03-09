/**
 * 数据库结构定义和SQL查询提示词
 * 用于DeepSeek API调用时的提示词构建
 */

// 数据库结构定义
const databaseSchema = {
  "databaseName": "media_crawler",
  "tables": {
    "bilibili_video": {
      "description": "B站视频数据表，存储B站视频的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["video_id", "视频ID"],
        ["video_type", "视频类型"],
        ["title", "视频标题"],
        ["create_time", "视频发布时间戳"],
        ["liked_count", "视频点赞数"],
        ["video_play_count", "视频播放数量"],
        ["video_danmaku", "视频弹幕数量"],
        ["video_comment", "视频评论数量"],
        ["source_keyword", "搜索来源关键字"],
        ["date", "视频发布日期，格式YYYY-MM-DD"]
      ]
    },
    "bilibili_up_info": {
      "description": "B站UP主信息表，存储B站创作者的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["total_fans", "粉丝数"],
        ["total_liked", "总获赞数"],
        ["user_rank", "用户等级"],
        ["is_official", "是否官号"]
      ]
    },
    "bilibili_video_comment": {
      "description": "B站视频评论表，存储B站视频的评论信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["comment_id", "评论ID"],
        ["video_id", "视频ID"],
        ["create_time", "评论时间戳"]
      ]
    },
    "douyin_aweme": {
      "description": "抖音视频表，存储抖音视频的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["aweme_id", "视频ID"],
        ["aweme_type", "视频类型"],
        ["title", "视频标题"],
        ["create_time", "视频发布时间戳"],
        ["liked_count", "视频点赞数"],
        ["comment_count", "视频评论数"],
        ["share_count", "视频分享数"],
        ["collected_count", "视频收藏数"],
        ["source_keyword", "搜索来源关键字"],
        ["date", "视频发布日期，格式YYYY-MM-DD"]
      ]
    },
    "douyin_aweme_comment": {
      "description": "抖音视频评论表，存储抖音视频的评论信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["comment_id", "评论ID"],
        ["aweme_id", "视频ID"],
        ["create_time", "评论时间戳"],
        ["like_count", "评论点赞数"]
      ]
    },
    "dy_creator": {
      "description": "抖音博主信息表，存储抖音创作者的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["gender", "性别"],
        ["follows", "关注数"],
        ["fans", "粉丝数"],
        ["interaction", "获赞数"],
        ["videos_count", "作品数"]
      ]
    },
    "xhs_creator": {
      "description": "小红书博主信息表，存储小红书创作者的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["gender", "性别"],
        ["follows", "关注数"],
        ["fans", "粉丝数"],
        ["interaction", "获赞和收藏数"]
      ]
    },
    "xhs_note": {
      "description": "小红书笔记表，存储小红书笔记的基本信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["note_id", "笔记ID"],
        ["type", "笔记类型(normal | video)"],
        ["title", "笔记标题"],
        ["time", "笔记发布时间戳"],
        ["liked_count", "笔记点赞数"],
        ["collected_count", "笔记收藏数"],
        ["comment_count", "笔记评论数"],
        ["share_count", "笔记分享数"],
        ["source_keyword", "搜索来源关键字"],
        ["date", "笔记发布日期，格式YYYY-MM-DD"]
      ]
    },
    "xhs_note_comment": {
      "description": "小红书笔记评论表，存储小红书笔记的评论信息",
      "columns": [
        ["user_id", "用户ID"],
        ["nickname", "用户昵称"],
        ["comment_id", "评论ID"],
        ["create_time", "评论时间戳"],
        ["note_id", "笔记ID"],
        ["like_count", "评论点赞数量"]
      ]
    }
  }
};

// SQL生成指导
const sqlGuidelines = `
生成SQL语句时，请确保遵循以下规则：
1. 使用准确的表名和列名，不要使用不存在的列
2. SQL语句应该使用单行格式，不包含换行符
3. 列出的所有表格均在media_crawler数据库中
4. 请确保SQL语法正确，不使用不支持的语法特性
5. 如果查询要求指定时间范围，优先使用date字段，而不是create_time字段
`;

// 合并数据库结构和提示词为一个完整对象
const databasePrompt = {
  schema: databaseSchema,
  guidelines: sqlGuidelines
};

// 返回所有有效的表名
export function getAllValidTableNames(): string[] {
  return Object.keys(databaseSchema.tables);
}

// 返回所有有效的列名
export function getAllValidColumnNames(): string[] {
  const columns: string[] = [];
  
  Object.values(databaseSchema.tables).forEach(table => {
    table.columns.forEach((column: string[]) => {
      const columnName = column[0];
      if (!columns.includes(columnName)) {
        columns.push(columnName);
      }
    });
  });
  
  return columns;
}

// 返回指定表的所有有效列名
export function getValidColumnNamesForTable(tableName: string): string[] {
  const table = databaseSchema.tables[tableName as keyof typeof databaseSchema.tables];
  if (!table) return [];
  
  return table.columns.map(column => column[0]);
}

// 分析SQL查询中的表名和列名
export function analyzeSqlQuery(sql: string): any {
  const validTables = getAllValidTableNames();
  const validColumns = getAllValidColumnNames();
  
  // 简单提取表名
  const tableRegex = /\bFROM\s+([\w_]+)|\bJOIN\s+([\w_]+)|\bUPDATE\s+([\w_]+)|\bINTO\s+([\w_]+)/gi;
  const extractedTables: string[] = [];
  let match;
  
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1] || match[2] || match[3] || match[4];
    if (tableName && !extractedTables.includes(tableName)) {
      extractedTables.push(tableName);
    }
  }
  
  // 检查无效表名
  const invalidTables = extractedTables
    .filter(table => !validTables.includes(table))
    .map(table => ({
      name: table,
      possibleCorrect: findSimilarNames(table, validTables)
    }));
  
  // 简单提取列名
  const columnRegex = /\bSELECT\s+(.+?)\s+FROM|\bWHERE\s+([\w_.]+)|\bGROUP\s+BY\s+([\w_.]+)|\bORDER\s+BY\s+([\w_.]+)|\bON\s+([\w_.]+)\s*=\s*([\w_.]+)/gi;
  const extractedColumns: string[] = [];
  
  // 提取SELECT部分的列名
  const selectMatch = /\bSELECT\s+(.+?)\s+FROM/i.exec(sql);
  if (selectMatch && selectMatch[1]) {
    const selectPart = selectMatch[1];
    const columns = selectPart.split(',').map(col => col.trim());
    
    columns.forEach(col => {
      // 处理别名和函数
      let processedCol = col.split(' AS ')[0].trim();
      processedCol = processedCol.split('.').pop() || '';
      
      // 排除函数和星号
      if (!processedCol.includes('(') && processedCol !== '*' && !extractedColumns.includes(processedCol)) {
        extractedColumns.push(processedCol);
      }
    });
  }
  
  // 提取其他部分的列名
  while ((match = columnRegex.exec(sql)) !== null) {
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        const cols = match[i].split(',').map(col => col.trim());
        
        cols.forEach(col => {
          if (col) {
            // 处理表前缀
            let processedCol = col.split('.').pop() || '';
            
            // 排除函数和星号
            if (!processedCol.includes('(') && processedCol !== '*' && !extractedColumns.includes(processedCol)) {
              extractedColumns.push(processedCol);
            }
          }
        });
      }
    }
  }
  
  // 检查无效列名
  const invalidColumns = extractedColumns
    .filter(col => !validColumns.includes(col))
    .map(col => ({
      name: col,
      possibleCorrect: findSimilarNames(col, validColumns)
    }));
  
  return {
    invalidTables,
    invalidColumns
  };
}

// 找出与给定名称相似的有效名称
function findSimilarNames(name: string, validNames: string[]): string[] {
  // 简单的相似度计算：检查前缀匹配和包含关系
  return validNames.filter(valid => 
    valid.startsWith(name.substring(0, 3)) || 
    valid.includes(name.substring(0, 3)) ||
    name.startsWith(valid.substring(0, 3)) ||
    name.includes(valid.substring(0, 3))
  );
}

export default databasePrompt;