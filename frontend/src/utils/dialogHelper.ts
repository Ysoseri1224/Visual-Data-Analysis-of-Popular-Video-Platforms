/**
 * 对话处理模块
 * 处理用户输入的对话
 */

import dialogExamples, { validateDialogResponse } from '../data/dialogExamples';
import { Message } from '../types/conversation';

// 对话状态
let currentDialogStage = 0;
let currentDialogIndex = -1;

/**
 * 生成系统响应
 * @param userMessage 用户输入的消息
 * @returns 系统生成的响应
 */
export async function generateSystemResponse(userMessage: string): Promise<Message> {
  // 模拟处理时间
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 检查是否是新对话
  if (currentDialogStage === 0) {
    // 查找匹配的对话示例
    currentDialogIndex = dialogExamples.findIndex(example => 
      userMessage.toLowerCase().includes(example.trigger.toLowerCase())
    );
    
    // 如果找到匹配的对话示例
    if (currentDialogIndex >= 0) {
      currentDialogStage = 1; // 进入对话流程
      
      // 根据不同的触发关键词，确保返回正确的第一轮回复
      const currentExample = dialogExamples[currentDialogIndex];
      let systemResponse = currentExample.responses[0];
      
      // 验证回复内容是否符合预期
      if (userMessage.includes("查看B站播放量")) {
        // 确保第一轮回复询问时间范围
        if (!systemResponse.includes("请问您需要查看哪个时间段的数据")) {
          console.warn("B站播放量分析第一轮回复不符合预期，已修正");
          systemResponse = "您想查看B站播放量前十的视频。请问您需要查看哪个时间段的数据？是最近一周、一个月还是全部时间？";
        }
      } else if (userMessage.includes("抖音热门话题")) {
        // 确保第一轮回复询问时间范围
        if (!systemResponse.includes("请问您是想了解哪个时间范围内的热门话题")) {
          console.warn("抖音热门话题分析第一轮回复不符合预期，已修正");
          systemResponse = "您想了解抖音上的热门话题。请问您是想了解哪个时间范围内的热门话题？例如最近一周、最近一个月？";
        }
      } else if (userMessage.includes("小红书美妆产品")) {
        // 确保第一轮回复询问衡量指标
        if (!systemResponse.includes("请问您想按照什么指标来衡量")) {
          console.warn("小红书美妆产品分析第一轮回复不符合预期，已修正");
          systemResponse = "您想了解小红书上最受欢迎的美妆产品。请问您想按照什么指标来衡量\"最受欢迎\"？是笔记数量、点赞数、收藏数，还是综合考虑？";
        }
      } else if (userMessage.includes("B站UP主粉丝")) {
        // 确保第一轮回复询问时间范围
        if (!systemResponse.includes("请问您想查看哪个时间段内的粉丝增长数据")) {
          console.warn("B站UP主粉丝增长分析第一轮回复不符合预期，已修正");
          systemResponse = "您想了解B站UP主粉丝增长情况。请问您想查看哪个时间段内的粉丝增长数据？例如最近一个月、三个月或者半年？";
        }
      } else if (userMessage.includes("抖音创作者收入")) {
        // 确保第一轮回复询问收入类型
        if (!systemResponse.includes("请问您是想了解哪种收入类型")) {
          console.warn("抖音创作者收入分析第一轮回复不符合预期，已修正");
          systemResponse = "您想了解抖音上收入最高的创作者。请问您是想了解哪种收入类型？例如广告收入、直播打赏收入、商品带货收入，还是综合所有收入？";
        }
      }
      
      return {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: systemResponse,
        timestamp: new Date(),
        sql: "",
        visualType: ""
      };
    }
  } else {
    // 如果是继续对话
    const currentExample = dialogExamples[currentDialogIndex];
    
    // 检查是否是最后一个对话阶段
    if (currentDialogStage < currentExample.responses.length) {
      let response = currentExample.responses[currentDialogStage];
      const trigger = currentExample.trigger;
      
      // 根据不同的触发关键词和当前对话阶段，确保返回正确的回复
      if (trigger.includes("查看B站播放量")) {
        if (currentDialogStage === 1) {
          // 第二轮回复应询问是否按分区筛选
          if (!response.includes("请问您需要按照特定分区筛选吗")) {
            console.warn("B站播放量分析第二轮回复不符合预期，已修正");
            response = "好的，您想查看最近一个月B站播放量前十的视频。请问您需要按照特定分区筛选吗？例如游戏区、生活区、动画区等。";
          }
        } else if (currentDialogStage === 2) {
          // 第三轮回复应生成SQL查询
          if (!response.includes("SELECT video_title, author_name, play_count")) {
            console.warn("B站播放量分析最终回复不符合预期，已修正");
            response = "明白了，我将为您查询最近一个月内全平台播放量前十的B站视频。\n\n```sql\nSELECT video_title, author_name, play_count, publish_date, video_url\nFROM bilibili_videos\nWHERE publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)\nORDER BY play_count DESC\nLIMIT 10;\n```";
          }
        }
      } else if (trigger.includes("抖音热门话题")) {
        if (currentDialogStage === 1) {
          // 第二轮回复应询问排序方式
          if (!response.includes("您是想按照话题的讨论量排序，还是按照相关视频的播放量排序")) {
            console.warn("抖音热门话题分析第二轮回复不符合预期，已修正");
            response = "好的，您想查看最近一周抖音的热门话题。您是想按照话题的讨论量排序，还是按照相关视频的播放量排序？";
          }
        } else if (currentDialogStage === 2) {
          // 第三轮回复应生成SQL查询
          if (!response.includes("SELECT topic_name, discussion_count")) {
            console.warn("抖音热门话题分析最终回复不符合预期，已修正");
            response = "明白了，我将为您查询最近一周内抖音上按讨论量排序的热门话题。\n\n```sql\nSELECT topic_name, discussion_count, video_count, total_play_count\nFROM douyin_topics\nWHERE create_time >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)\nORDER BY discussion_count DESC\nLIMIT 15;\n```";
          }
        }
      } else if (trigger.includes("小红书美妆产品")) {
        if (currentDialogStage === 1) {
          // 第二轮回复应询问时间范围
          if (!response.includes("请问您想查看哪个时间段的数据")) {
            console.warn("小红书美妆产品分析第二轮回复不符合预期，已修正");
            response = "好的，我们可以综合考虑点赞数、收藏数和评论数来计算互动总量。请问您想查看哪个时间段的数据？例如最近三个月、半年或者全年？";
          }
        } else if (currentDialogStage === 2) {
          // 第三轮回复应生成SQL查询
          if (!response.includes("SELECT product_name, brand_name")) {
            console.warn("小红书美妆产品分析最终回复不符合预期，已修正");
            response = "明白了，我将为您查询最近三个月小红书上互动量最高的美妆产品。\n\n```sql\nSELECT product_name, brand_name, \n       SUM(like_count) as total_likes, \n       SUM(collect_count) as total_collects,\n       SUM(comment_count) as total_comments,\n       SUM(like_count + collect_count + comment_count) as total_engagement,\n       COUNT(DISTINCT note_id) as note_count\nFROM xiaohongshu_notes\nWHERE category = '美妆' \n  AND publish_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)\nGROUP BY product_name, brand_name\nORDER BY total_engagement DESC\nLIMIT 10;\n```";
          }
        }
      } else if (trigger.includes("B站UP主粉丝")) {
        if (currentDialogStage === 1) {
          // 第二轮回复应询问排序方式
          if (!response.includes("请问您想按照绝对增长数量还是增长率来排序")) {
            console.warn("B站UP主粉丝增长分析第二轮回复不符合预期，已修正");
            response = "好的，您想查看最近三个月B站UP主的粉丝增长情况。请问您想按照绝对增长数量还是增长率来排序？";
          }
        } else if (currentDialogStage === 2) {
          // 第三轮回复应生成SQL查询
          if (!response.includes("SELECT author_name, current_followers")) {
            console.warn("B站UP主粉丝增长分析最终回复不符合预期，已修正");
            response = "明白了，我将为您查询最近三个月B站UP主的粉丝绝对增长数量和增长率排名。\n\n```sql\n-- 按绝对增长数量排序\nSELECT author_name, current_followers, \n       (current_followers - followers_3_month_ago) as absolute_growth,\n       ROUND((current_followers - followers_3_month_ago) / followers_3_month_ago * 100, 2) as growth_rate,\n       main_category\nFROM bilibili_authors\nWHERE followers_3_month_ago > 10000  -- 筛选有一定基础粉丝量的UP主\nORDER BY absolute_growth DESC\nLIMIT 10;\n```";
          }
        }
      } else if (trigger.includes("抖音创作者收入")) {
        if (currentDialogStage === 1) {
          // 第二轮回复应询问时间范围
          if (!response.includes("请问您想查看哪个时间段的数据")) {
            console.warn("抖音创作者收入分析第二轮回复不符合预期，已修正");
            response = "好的，您想查看综合所有收入来源的抖音创作者收入排名。请问您想查看哪个时间段的数据？例如最近一个月、最近一年？";
          }
        } else if (currentDialogStage === 2) {
          // 第三轮回复应询问是否分组
          if (!response.includes("请问您是否需要按照创作者的内容类别进行分组展示")) {
            console.warn("抖音创作者收入分析第三轮回复不符合预期，已修正");
            response = "明白了，我将为您查询最近一年内抖音创作者的综合收入排名。请问您是否需要按照创作者的内容类别进行分组展示？";
          }
        } else if (currentDialogStage === 3) {
          // 第四轮回复应生成SQL查询
          if (!response.includes("SELECT creator_name, content_category")) {
            console.warn("抖音创作者收入分析最终回复不符合预期，已修正");
            response = "好的，我将为您查询最近一年内按内容类别分组的抖音创作者综合收入排名。\n\n```sql\nSELECT creator_name, content_category,\n       SUM(ad_income) as total_ad_income,\n       SUM(live_income) as total_live_income,\n       SUM(ecommerce_income) as total_ecommerce_income,\n       SUM(ad_income + live_income + ecommerce_income) as total_income,\n       follower_count\nFROM douyin_creators\nWHERE income_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR)\nGROUP BY creator_name, content_category, follower_count\nORDER BY content_category, total_income DESC;\n```";
          }
        }
      }
      
      // 检查是否是最后一个对话阶段
      const isLastStage = currentDialogStage === currentExample.responses.length - 1;
      
      // 更新对话状态
      currentDialogStage++;
      
      // 使用validateDialogResponse函数验证对话回复
      try {
        validateDialogResponse(userMessage, response, currentDialogStage);
      } catch (error) {
        console.error('对话验证失败:', error);
      }
      
      // 如果是最后一个对话阶段
      if (isLastStage) {
        setTimeout(() => {
          currentDialogStage = 0;
          currentDialogIndex = -1;
        }, 1000);
        
        return {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          sql: currentExample.sql,
          visualType: currentExample.visualType
        };
      } else {
        return {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          sql: "",
          visualType: ""
        };
      }
    }
  }
  
  // 如果没有找到匹配的对话示例
  const defaultResponses = [
    `我已收到您的消息："${userMessage}"。正在分析中...`,
    `根据您的问题，我生成了以下SQL查询：\n\`\`\`sql\nSELECT * FROM users LIMIT 10;\n\`\`\`\n\n我建议使用表格来可视化这些结果。`,
    `您的问题需要更复杂的查询：\n\`\`\`sql\nSELECT category, COUNT(*) as count, AVG(price) as avg_price FROM products GROUP BY category ORDER BY count DESC;\n\`\`\`\n\n我建议使用柱状图来可视化这些结果。`,
    `基于您的输入，以下是一个时间序列分析：\n\`\`\`sql\nSELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as total_sales FROM orders GROUP BY month ORDER BY month;\n\`\`\`\n\n我建议使用折线图来可视化这些时间序列数据。`
  ];
  
  // 随机选择一个响应
  const randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  
  // 随机生成SQL查询和可视化类型
  const sqlQueries = [
    "SELECT * FROM users LIMIT 10;",
    "SELECT category, COUNT(*) as count FROM products GROUP BY category;",
    "SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as total FROM orders GROUP BY month;"
  ];
  
  const visualTypes = ["table", "bar", "line", "pie"];
  
  // 重置对话状态
  currentDialogStage = 0;
  currentDialogIndex = -1;
  
  return {
    id: `system-${Date.now()}`,
    role: 'assistant',
    content: randomResponse,
    timestamp: new Date(),
    sql: sqlQueries[Math.floor(Math.random() * sqlQueries.length)],
    visualType: visualTypes[Math.floor(Math.random() * visualTypes.length)]
  };
}
