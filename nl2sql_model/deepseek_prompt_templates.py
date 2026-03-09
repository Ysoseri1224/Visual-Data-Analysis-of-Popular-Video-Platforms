"""
DeepSeek API的专用提示词模板
设计针对NL2SQL任务的高质量提示词，确保生成准确的SQL查询
"""

# 系统提示词模板
SYSTEM_PROMPT_TEMPLATE = """你是一个专业的数据库SQL专家，专门负责将自然语言转换为SQL查询，用于数据可视化。
请严格按照以下规则：

1. 只输出SQL查询，不要有任何解释或其他文本
2. 确保SQL查询语法正确，可以直接执行
3. 针对{visualization_type}图表类型生成适当的SQL查询
4. 使用标准SQL语法，避免使用特定数据库的扩展功能
5. 不要使用不在模式中的表或列
6. 确保生成的SQL查询结果能够直接用于{visualization_type}图表的绘制
7. 对于聚合查询，确保GROUP BY子句包含所有非聚合列
8. 如果需要连接表，使用明确的JOIN条件
9. 对于时间序列数据，确保按时间排序
10. 对于分类数据，考虑使用ORDER BY和LIMIT来限制结果数量

数据库模式如下：
{schema}

针对不同可视化类型的SQL查询要求：

- line（折线图）: 通常需要时间序列数据，应该包含日期/时间列和数值列，并按时间排序
- bar（柱状图）: 需要分类数据和对应的数值，通常使用GROUP BY和聚合函数
- pie（饼图）: 需要分类和对应的数值，通常使用GROUP BY和COUNT或SUM
- scatter（散点图）: 需要两个数值列，表示X和Y坐标
- wordcloud（词云图）: 需要文本列，如标题或内容
- radar（雷达图）: 需要多个维度的数据，通常使用多个聚合列

请确保你的SQL查询符合{visualization_type}图表的数据需求。
"""

# 用户提示词模板
USER_PROMPT_TEMPLATE = """请将以下自然语言问题转换为SQL查询，用于生成{visualization_type}图表：

问题：{question}

请直接输出SQL查询，不需要任何解释。"""

# 针对不同可视化类型的特定提示
VISUALIZATION_TYPE_HINTS = {
    "line": """
对于折线图，SQL查询应该：
1. 包含一个时间/日期列和至少一个数值列
2. 使用GROUP BY按时间分组
3. 按时间列排序（ORDER BY）
4. 如果比较多个系列，可以使用UNION ALL或条件聚合
""",
    
    "bar": """
对于柱状图，SQL查询应该：
1. 包含一个分类列和至少一个数值列
2. 使用GROUP BY按分类分组
3. 通常按数值列排序（ORDER BY）
4. 考虑使用LIMIT限制结果数量，避免图表过于复杂
""",
    
    "pie": """
对于饼图，SQL查询应该：
1. 包含一个分类列和一个数值列
2. 使用GROUP BY按分类分组
3. 通常使用COUNT或SUM作为聚合函数
4. 考虑使用LIMIT限制结果数量，避免图表过于复杂
""",
    
    "scatter": """
对于散点图，SQL查询应该：
1. 选择两个数值列，分别作为X轴和Y轴
2. 确保数值可以被正确转换（使用CAST AS UNSIGNED等）
3. 可以添加额外的列用于点的大小或颜色
4. 考虑使用LIMIT限制结果数量，避免图表过于拥挤
""",
    
    "wordcloud": """
对于词云图，SQL查询应该：
1. 选择包含文本的列，如标题或内容
2. 可以使用LIMIT限制结果数量
3. 不需要聚合函数，直接返回文本数据
""",
    
    "radar": """
对于雷达图，SQL查询应该：
1. 包含一个分类列和多个数值列（至少3个）
2. 每个数值列代表雷达图的一个维度
3. 使用GROUP BY按分类分组
4. 通常使用AVG或SUM作为聚合函数
"""
}

def get_system_prompt(visualization_type, schema):
    """获取系统提示词"""
    base_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        visualization_type=visualization_type,
        schema=schema
    )
    
    # 添加特定可视化类型的提示
    if visualization_type in VISUALIZATION_TYPE_HINTS:
        base_prompt += VISUALIZATION_TYPE_HINTS[visualization_type]
    
    return base_prompt

def get_user_prompt(question, visualization_type):
    """获取用户提示词"""
    return USER_PROMPT_TEMPLATE.format(
        question=question,
        visualization_type=visualization_type
    )

def get_example_prompts(visualization_type):
    """获取示例提示词"""
    examples = {
        "line": [
            {
                "question": "统计B站每天发布的视频数量",
                "sql": "SELECT date, COUNT(*) as video_count FROM bilibili_video GROUP BY date ORDER BY date"
            },
            {
                "question": "分析抖音平台最近一个月的内容发布趋势",
                "sql": "SELECT date, COUNT(*) as content_count FROM douyin_aweme WHERE date BETWEEN '2025-03-01' AND '2025-04-01' GROUP BY date ORDER BY date"
            }
        ],
        "bar": [
            {
                "question": "比较抖音和小红书平台的内容发布量",
                "sql": "SELECT '抖音' as platform, COUNT(*) as content_count FROM douyin_aweme UNION ALL SELECT '小红书' as platform, COUNT(*) as content_count FROM xhs_note"
            },
            {
                "question": "分析B站不同类型视频的数量分布",
                "sql": "SELECT video_type as type, COUNT(*) as count FROM bilibili_video GROUP BY video_type ORDER BY count DESC"
            }
        ],
        "pie": [
            {
                "question": "分析小红书笔记类型的分布情况",
                "sql": "SELECT type, COUNT(*) as note_count FROM xhs_note GROUP BY type ORDER BY note_count DESC"
            },
            {
                "question": "统计B站UP主粉丝数量的分布",
                "sql": "SELECT CASE WHEN total_fans < 1000 THEN '小于1千' WHEN total_fans < 10000 THEN '1千-1万' WHEN total_fans < 100000 THEN '1万-10万' ELSE '10万以上' END as fans_range, COUNT(*) as up_count FROM bilibili_up_info GROUP BY fans_range"
            }
        ],
        "scatter": [
            {
                "question": "分析抖音视频点赞数与评论数的关系",
                "sql": "SELECT CAST(liked_count AS UNSIGNED) as like_count, CAST(comment_count AS UNSIGNED) as comment_count FROM douyin_aweme"
            },
            {
                "question": "研究B站视频播放量与弹幕数的相关性",
                "sql": "SELECT CAST(video_play_count AS UNSIGNED) as play_count, CAST(video_danmaku AS UNSIGNED) as danmaku_count FROM bilibili_video"
            }
        ],
        "wordcloud": [
            {
                "question": "生成B站视频标题的词云图",
                "sql": "SELECT title FROM bilibili_video LIMIT 1000"
            },
            {
                "question": "分析小红书热门笔记的标题关键词",
                "sql": "SELECT title FROM xhs_note ORDER BY CAST(liked_count AS UNSIGNED) DESC LIMIT 500"
            }
        ],
        "radar": [
            {
                "question": "比较各平台内容的互动指标",
                "sql": "SELECT '哔哩哔哩' as platform, AVG(CAST(liked_count AS UNSIGNED)) as avg_likes, AVG(CAST(video_comment AS UNSIGNED)) as avg_comments, AVG(CAST(video_danmaku AS UNSIGNED)) as avg_danmaku FROM bilibili_video UNION ALL SELECT '抖音' as platform, AVG(CAST(liked_count AS UNSIGNED)) as avg_likes, AVG(CAST(comment_count AS UNSIGNED)) as avg_comments, AVG(CAST(share_count AS UNSIGNED)) as avg_shares FROM douyin_aweme UNION ALL SELECT '小红书' as platform, AVG(CAST(liked_count AS UNSIGNED)) as avg_likes, AVG(CAST(comment_count AS UNSIGNED)) as avg_comments, AVG(CAST(collected_count AS UNSIGNED)) as avg_collects FROM xhs_note"
            },
            {
                "question": "分析抖音不同类型内容的互动表现",
                "sql": "SELECT type, AVG(CAST(liked_count AS UNSIGNED)) as avg_likes, AVG(CAST(comment_count AS UNSIGNED)) as avg_comments, AVG(CAST(share_count AS UNSIGNED)) as avg_shares FROM douyin_aweme GROUP BY type"
            }
        ]
    }
    
    return examples.get(visualization_type, [])
