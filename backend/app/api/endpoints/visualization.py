from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import logging

from app.services.deepseek_service import generate_response
from app.api.endpoints.auth import get_current_user
from app.models.user import UserInDB

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()

class EchartsRequest(BaseModel):
    """Echarts数据可视化请求模型"""
    sql_query: str
    query_result: Dict[str, Any]  # 包含columns和rows的查询结果
    user_question: str
    bot_response: str

class EchartsResponse(BaseModel):
    """Echarts数据可视化响应模型"""
    options: Dict[str, Any]

@router.post("/generate-echarts", response_model=EchartsResponse)
async def generate_echarts_options(
    request: EchartsRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """根据SQL查询结果和对话内容生成Echarts配置"""
    try:
        logger.info(f"收到Echarts生成请求: SQL={request.sql_query}, 用户问题={request.user_question}")
        
        # 准备提示词
        system_prompt = f"""
你是一位数据可视化专家，负责为用户生成Echarts图表配置。
请基于以下信息生成最适合的Echarts配置JSON：

1. 用户原始问题: {request.user_question}
2. 系统生成的SQL查询: {request.sql_query}
3. SQL查询结果数据:
{json.dumps(request.query_result, ensure_ascii=False, indent=2)}

你的任务是分析这些信息，确定最适合的图表类型并生成完整的Echarts options配置。
只返回一个完整的JSON对象，格式为Echarts options配置，不要包含任何解释或其他文本。
确保生成的配置能够直接用于Echarts图表渲染。

注意事项:
- 根据数据特点智能选择合适的图表类型（柱状图、折线图、饼图等）
- 为图表提供合适的标题，基于用户问题和数据内容
- 添加适当的图例、提示框和轴标签，确保图表易于理解
- 添加美观的样式和配色方案，提升视觉效果
- 确保配置可以直接用于Echarts渲染，无需额外处理
"""

        # 调用DeepSeek生成Echarts配置
        response = await generate_response(
            user_message=f"基于SQL查询'{request.sql_query}'和查询结果生成Echarts配置",
            system_prompt=system_prompt
        )
        
        logger.info("DeepSeek生成的原始响应: " + response[:100] + "...")
        
        # 提取JSON
        try:
            # 尝试直接解析JSON
            options = json.loads(response)
        except json.JSONDecodeError:
            # 如果直接解析失败，尝试提取JSON部分
            try:
                # 查找可能的JSON开始和结束位置
                start_idx = response.find('{')
                end_idx = response.rfind('}') + 1
                
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = response[start_idx:end_idx]
                    options = json.loads(json_str)
                else:
                    raise ValueError("无法在响应中找到有效的JSON")
            except Exception as e:
                logger.error(f"JSON提取失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"无法解析Echarts配置: {str(e)}")
        
        # 日志记录
        logger.info("成功生成Echarts配置")
        
        return EchartsResponse(options=options)
    
    except Exception as e:
        logger.error(f"生成Echarts配置时出错: {str(e)}")
        # 返回用户友好的错误信息
        raise HTTPException(status_code=500, detail=f"生成图表配置失败: {str(e)}")
