import aiohttp
import json
import os
import time
import httpx
from typing import Dict, Any, AsyncGenerator, List, Optional
from app.core.config import settings

# 从环境变量或配置文件获取API密钥
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", settings.DEEPSEEK_API_KEY)

# DeepSeek API端点
API_URL = "https://api.deepseek.com/v1/chat/completions"

# 获取数据库结构的函数
async def get_database_schema() -> str:
    """
    从数据库结构API获取表名和列名信息
    返回格式化的文本描述
    """
    # 根据main.py的配置，我们的后端服务运行在8080端口
    api_url = "http://localhost:8080/api/schema/database-schema"
    print(f"\n[DEBUG] 尝试获取数据库结构，请求URL: {api_url}")
    
    try:
        # 添加超时设置和错误跟踪
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("[DEBUG] 发送API请求中...")
            response = await client.get(api_url)
            
            print(f"[DEBUG] API响应状态码: {response.status_code}")
            if response.status_code == 200:
                schema_data = response.json()
                print(f"[DEBUG] 成功获取数据库结构: {json.dumps(schema_data, indent=2, ensure_ascii=False)[:500]}...(truncated)")
                formatted_prompt = format_schema_as_prompt(schema_data)
                print(f"[DEBUG] 格式化后的提示词: \n{formatted_prompt[:500]}...(truncated)")
                return formatted_prompt
            else:
                error_text = response.text
                print(f"[ERROR] 获取数据库结构失败: HTTP 状态码 {response.status_code}")
                print(f"[ERROR] 错误响应内容: {error_text[:200]}...(truncated)")
                
                # 如果接口不可用，返回静态的数据库结构信息
                print("[DEBUG] 使用静态数据库结构信息作为备选方案")
                return get_static_database_schema()
    except Exception as e:
        import traceback
        print(f"[ERROR] 获取数据库结构时出错: {str(e)}")
        print(f"[ERROR] 错误详情: {traceback.format_exc()}")
        
        # 异常情况下返回静态的数据库结构信息
        print("[DEBUG] 使用静态数据库结构信息作为备选方案")
        return get_static_database_schema()

# 添加静态的数据库结构信息函数
# 包含了所有重要表的结构，避免了API调用问题
def get_static_database_schema() -> str:
    """返回静态的数据库结构信息，作为主要数据源"""
    return """数据库结构:

表名: bilibili_up_info
列名:
- id: INT(11) (主键)
- uid: VARCHAR(50)
- uname: VARCHAR(100)
- gender: VARCHAR(10)
- sign: TEXT
- level: INT(11)
- follower: INT(11)
- following: INT(11)
- likes: INT(11)
- archive_count: INT(11)
- article_count: INT(11)
- face: VARCHAR(255)
- top_photo: VARCHAR(255)
- birthday: VARCHAR(50)
- school: VARCHAR(100)
- official_verify: VARCHAR(255)
- is_senior_member: INT(1)
- is_live: INT(1)
- room_id: VARCHAR(50)
- live_status: INT(11)
- live_title: VARCHAR(255)
- crawl_time: DATETIME

表名: bilibili_video
列名:
- id: INT(11) (主键)
- video_id: VARCHAR(50)
- video_title: VARCHAR(255)
- video_author: VARCHAR(100)
- video_publish_time: DATETIME
- video_description: TEXT
- video_play_count: INT(11)
- video_like_count: INT(11)
- video_coin_count: INT(11)
- video_forward_count: INT(11)
- video_comment_count: INT(11)
- video_category: VARCHAR(50)
- video_tags: VARCHAR(255)
- video_url: VARCHAR(255)
- video_cover_url: VARCHAR(255)
- crawl_time: DATETIME

表名: bilibili_video_comment
列名:
- id: INT(11) (主键)
- comment_id: VARCHAR(50)
- video_id: VARCHAR(50)
- user_id: VARCHAR(50)
- user_name: VARCHAR(100)
- content: TEXT
- like_count: INT(11)
- reply_count: INT(11)
- floor: INT(11)
- publish_time: DATETIME
- crawl_time: DATETIME

表名: douyin_aweme
列名:
- id: INT(11) (主键)
- aweme_id: VARCHAR(50)
- desc: TEXT
- create_time: DATETIME
- author_user_id: VARCHAR(50)
- author_nickname: VARCHAR(100)
- music_id: VARCHAR(50)
- music_title: VARCHAR(255)
- video_play_count: INT(11)
- video_like_count: INT(11)
- video_comment_count: INT(11)
- video_share_count: INT(11)
- video_download_count: INT(11)
- video_forward_count: INT(11)
- video_duration: INT(11)
- video_cover_url: VARCHAR(255)
- video_url: VARCHAR(255)
- crawl_time: DATETIME

表名: douyin_aweme_comment
列名:
- id: INT(11) (主键)
- cid: VARCHAR(50)
- aweme_id: VARCHAR(50)
- user_id: VARCHAR(50)
- sec_uid: VARCHAR(100)
- nickname: VARCHAR(100)
- avatar: VARCHAR(255)
- text: TEXT
- create_time: DATETIME
- like_count: INT(11)
- crawl_time: DATETIME

表名: dy_creator
列名:
- id: INT(11) (主键)
- user_id: VARCHAR(50)
- sec_uid: VARCHAR(100)
- short_id: VARCHAR(50)
- unique_id: VARCHAR(100)
- nickname: VARCHAR(100)
- signature: TEXT
- avatar: VARCHAR(255)
- follower_count: INT(11)
- following_count: INT(11)
- total_favorited: INT(11)
- aweme_count: INT(11)
- verification_type: INT(11)
- enterprise_verify_reason: VARCHAR(255)
- custom_verify: VARCHAR(255)
- crawl_time: DATETIME

表名: xhs_creator
列名:
- id: INT(11) (主键)
- user_id: VARCHAR(50)
- nickname: VARCHAR(100)
- avatar: VARCHAR(255)
- description: TEXT
- gender: VARCHAR(10)
- location: VARCHAR(100)
- follower_count: INT(11)
- following_count: INT(11)
- note_count: INT(11)
- liked_count: INT(11)
- collected_count: INT(11)
- interaction_count: INT(11)
- crawl_time: DATETIME

表名: xhs_note
列名:
- id: INT(11) (主键)
- note_id: VARCHAR(50)
- title: VARCHAR(255)
- desc: TEXT
- user_id: VARCHAR(50)
- nickname: VARCHAR(100)
- tag_list: TEXT
- type: VARCHAR(50)
- image_list: TEXT
- video_url: VARCHAR(255)
- like_count: INT(11)
- collect_count: INT(11)
- comment_count: INT(11)
- share_count: INT(11)
- time: DATETIME
- crawl_time: DATETIME

表名: xhs_note_comment
列名:
- id: INT(11) (主键)
- comment_id: VARCHAR(50)
- note_id: VARCHAR(50)
- user_id: VARCHAR(50)
- nickname: VARCHAR(100)
- avatar: VARCHAR(255)
- content: TEXT
- create_time: DATETIME
- like_count: INT(11)
- sub_comment_count: INT(11)
- crawl_time: DATETIME
"""


def format_schema_as_prompt(schema_data: Dict[str, Any]) -> str:
    """
    将数据库结构格式化为文本描述用于提示词
    """
    prompt = "数据库结构:\n"
    
    for table in schema_data.get("tables", []):
        table_name = table.get("name", "")
        prompt += f"\n表名: {table_name}\n"
        prompt += "列名:\n"
        
        for column in table.get("columns", []):
            column_name = column.get("name", "")
            column_type = column.get("type", "")
            pk_marker = " (主键)" if column_name in table.get("primary_keys", []) else ""
            prompt += f"- {column_name}: {column_type}{pk_marker}\n"
    
    return prompt

# 基础系统提示词
BASE_SYSTEM_PROMPT = """
你是一个专业的SQL转换助手。请将以下自然语言查询转换为标准SQL语句。

非常重要！请遵循以下强制性规则：
1. 只返回SQL语句，不要包含解释或其他任何文本
2. 严格使用以下提供的表名和列名，不得自行编造或修改
3. 如果数据库结构中没有用户要求的表或列，请使用最接近的实际表和列去处理查询

例如，如果用户说"查询B站视频的数据"，则必须使用'bilibili_video'表；
如果用户说"按播放量排序"，则必须使用'video_play_count'列，而不是'play_count'。

以下是实际数据库中的表和列，你必须严格使用这些名称：
"""

# 默认系统提示词(兼容旧版本)
DEFAULT_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT

# 获取带数据库结构的完整提示词
async def get_full_system_prompt(custom_prompt: str = "") -> str:
    """
    组合基础提示词和数据库结构信息
    """
    # 使用自定义提示词或默认提示词
    prompt = custom_prompt if custom_prompt else BASE_SYSTEM_PROMPT
    
    # 获取数据库结构
    schema_info = await get_database_schema()
    
    # 组合完整提示词
    if schema_info:
        full_prompt = f"{prompt}\n\n{schema_info}"
    else:
        full_prompt = prompt
    
    return full_prompt

async def generate_response(user_message: str, system_prompt: str = "", history: Optional[List[Dict[str, str]]] = None) -> str:
    """
    生成非流式AI回复
    
    参数:
        user_message: 用户消息
        system_prompt: 系统提示词（可选）
        history: 对话历史记录，格式为[{"role": "user", "content": "..."}]
    
    返回:
        AI回复内容
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    # 获取含有数据库结构的完整提示词
    full_prompt = await get_full_system_prompt(system_prompt)
    print(f"[调用DeepSeek] 使用带数据库结构的提示词")
    
    # 构建消息列表
    messages = [{"role": "system", "content": full_prompt}]
    
    # 添加历史消息（如果有）
    if history and isinstance(history, list):
        messages.extend(history)
    
    # 添加当前用户消息
    messages.append({"role": "user", "content": user_message})
    
    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API请求失败: {response.status}, {error_text}")
                
                result = await response.json()
                return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"调用DeepSeek API出错: {str(e)}")
        # 如果API调用失败，返回一个友好的错误消息
        return f"很抱歉，我暂时无法处理您的请求。请稍后再试。(错误: {str(e)})"

async def generate_streaming_response(user_message: str, system_prompt: str = "", history: Optional[List[Dict[str, str]]] = None) -> AsyncGenerator[str, None]:
    """
    生成流式AI回复
    
    参数:
        user_message: 用户消息
        system_prompt: 系统提示词
        history: 对话历史记录，格式为[{"role": "user", "content": "..."}]
    
    返回:
        异步生成器，生成AI回复内容的片段
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    # 获取含有数据库结构的完整提示词
    full_prompt = await get_full_system_prompt(system_prompt)
    print(f"[流式调用DeepSeek] 使用含数据库结构的提示词")
    
    # 构建消息列表
    messages = [{
        "role": "system",
        "content": full_prompt
    }]
    # 添加历史消息（如果有）
    if history and isinstance(history, list):
        messages.extend(history)
    
    # 添加当前用户消息
    messages.append({"role": "user", "content": user_message})
    
    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000,
        "stream": True
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    yield f"API请求失败: {response.status}, {error_text}"
                    return
                
                # 处理流式响应
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    if line.startswith('data: '):
                        line = line[6:]
                        if line == "[DONE]":
                            break
                        try:
                            data = json.loads(line)
                            content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        print(f"流式调用DeepSeek API出错: {str(e)}")
        yield f"很抱歉，我暂时无法处理您的请求。请稍后再试。(错误: {str(e)})"

async def analyze_sql_query(user_message: str) -> Dict[str, Any]:
    """
    分析用户消息，生成SQL查询和可视化建议
    """
    system_prompt = """
你是一个专业的数据分析助手，擅长将自然语言转换为SQL查询。
请分析用户的问题，并生成相应的SQL查询语句。同时，请推荐最适合展示查询结果的可视化类型。

返回格式必须是JSON，包含以下字段：
1. sql: 生成的SQL查询语句
2. visualization_type: 推荐的可视化类型，可选值为 'table', 'bar', 'line', 'pie', 'scatter', 'area'
3. explanation: 对SQL查询和可视化选择的简短解释

示例：
用户: "查询最近一个月销量最高的5个产品"
回复: {"sql":"SELECT product_name, SUM(quantity) as total_sales FROM sales WHERE sale_date >= DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH) GROUP BY product_name ORDER BY total_sales DESC LIMIT 5;","visualization_type":"bar","explanation":"柱状图最适合比较不同产品的销售量大小。"}
"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.1,  # 降低温度以获得更确定性的回复
        "max_tokens": 1000
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API请求失败: {response.status}, {error_text}")
                
                result = await response.json()
                content = result["choices"][0]["message"]["content"]
                
                # 尝试解析JSON响应
                try:
                    # 清理可能的非JSON前缀
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    
                    data = json.loads(content)
                    return {
                        "sql": data.get("sql", ""),
                        "visualization_type": data.get("visualization_type", "table"),
                        "explanation": data.get("explanation", "")
                    }
                except json.JSONDecodeError:
                    # 如果无法解析JSON，返回一个默认结构
                    return {
                        "sql": "",
                        "visualization_type": "table",
                        "explanation": "无法生成SQL查询。请尝试重新表述您的问题。",
                        "raw_content": content  # 包含原始内容以便调试
                    }
    except Exception as e:
        print(f"分析SQL查询时出错: {str(e)}")
        return {
            "sql": "",
            "visualization_type": "table",
            "explanation": f"生成SQL时发生未知错误: {str(e)}",
            "error": True  # 添加错误标志
        }

async def generate_visualization_from_sql(sql_query: str, columns: List[str], sample_data: List[List[Any]]) -> Dict[str, Any]:
    """
    根据SQL查询和样本数据生成可视化建议
    
    参数:
        sql_query: SQL查询语句
        columns: 列名列表
        sample_data: 样本数据（前几行）
    
    返回:
        包含图表类型、标题和描述的字典
    """
    system_prompt = """
你是一个专业的数据可视化专家，擅长分析数据并推荐最适合的可视化方式。
请分析提供的SQL查询、列名和样本数据，然后推荐最适合的图表类型。

返回格式必须是JSON，包含以下字段:
1. chartType: 推荐的图表类型，可选值为 'bar', 'line', 'pie', 'doughnut'
2. title: 图表标题
3. description: 对数据和可视化选择的简短解释

请根据数据的特点选择最合适的图表类型:
- 如果是比较不同类别的数值，使用柱状图(bar)
- 如果是展示数据的时间趋势，使用折线图(line)
- 如果是展示数据的比例分布，使用饼图(pie)或环形图(doughnut)
"""
    
    # 准备请求数据
    sample_data_str = json.dumps(sample_data, ensure_ascii=False)
    columns_str = json.dumps(columns, ensure_ascii=False)
    
    user_message = f"""
请分析以下SQL查询和数据样本，推荐最适合的图表类型:

SQL查询: {sql_query}

列名: {columns_str}

样本数据: {sample_data_str}
"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.3,  # 降低温度以获得更确定性的回复
        "max_tokens": 1000
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"API请求失败: {response.status}, {error_text}")
                    return {
                        "chartType": "bar",
                        "title": "数据可视化",
                        "description": "无法获取可视化建议，使用默认柱状图"
                    }
                
                result = await response.json()
                content = result["choices"][0]["message"]["content"]
                
                # 尝试解析JSON响应
                try:
                    # 清理可能的非JSON前缀
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    
                    data = json.loads(content)
                    return {
                        "chartType": data.get("chartType", "bar"),
                        "title": data.get("title", "数据可视化"),
                        "description": data.get("description", "")
                    }
                except json.JSONDecodeError:
                    # 如果无法解析JSON，返回一个默认结构
                    print(f"无法解析JSON响应: {content}")
                    return {
                        "chartType": "bar",
                        "title": "数据可视化",
                        "description": "基于查询结果生成的柱状图"
                    }
    except Exception as e:
        print(f"生成可视化建议时出错: {str(e)}")
        return {
            "chartType": "bar",
            "title": "数据可视化",
            "description": f"生成可视化建议时出错: {str(e)}"
        }
