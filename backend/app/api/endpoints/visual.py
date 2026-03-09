from typing import Any, Dict, List, Optional
import logging
import sys

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.services.data_service import execute_sql_query, get_visualization_data
from app.services.deepseek_service import generate_visualization_from_sql

# 初始化日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# 添加日志处理器，输出到控制台
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s')
handler.setFormatter(formatter)

# 确保日志器没有重复的处理器
if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
    logger.addHandler(handler)

router = APIRouter()

class VisualQuery(BaseModel):
    query: str
    database: Optional[str] = None
    
    class Config:
        # 允许额外属性，避免参数不匹配
        extra = "allow"

class VisualResponse(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    chartType: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None

@router.post("/visual")
async def visual_data(query: VisualQuery) -> Any:
    """
    u6839u636eSqlu67e5u8be2u751fu6210u53efu89c6u5316u6570u636e
    """
    try:
        # u8bb0u5f55u8bf7u6c42u6570u636e
        logger.info(f"\n====== u6536u5230u53efu89c6u5316u8bf7u6c42 ======")
        logger.info(f"SQL: {query.query}")
        logger.info(f"u6570u636eu5e93: {query.database}")
        
        # u9a8cu8bc1SQLu67e5u8be2
        if not query.query or not query.query.strip():
            logger.warning("u63d0u4ea4u4e86u7a7au7684SQLu67e5u8be2")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SQLu67e5u8be2u4e0du80fdu4e3au7a7a"
            )
        
        # u6267u884cSQLu67e5u8be2
        logger.info(f"u6b63u5728u6267u884cu67e5u8be2...")
        results, error = await execute_sql_query(query.query, query.database)
        
        if error:
            logger.error(f"SQL u67e5u8be2u9519u8bef: {error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        # u5982u679cu6ca1u6709u7ed3u679cuff0cu8fd4u56deu7a7au8868
        if not results:
            return {
                "columns": [],
                "rows": [],
                "chartType": "bar",
                "title": "u67e5u8be2u7ed3u679cu4e3au7a7a",
                "description": "u6ca1u6709u627eu5230u7b26u5408u67e5u8be2u6761u4ef6u7684u6570u636e"
            }
        
        # u63d0u53d6u5217u540d
        columns = list(results[0].keys())
        
        # u5c06u7ed3u679cu8f6cu6362u4e3au884cu6570u636e
        rows = [list(row.values()) for row in results]
        
        # u4f7fu7528DeepSeek APIu751fu6210u53efu89c6u5316u5efau8bae
        visualization_info = await generate_visualization_from_sql(
            query.query,
            columns,
            rows[:5]  # u53eau53d1u9001u524d5u884cu6570u636eu7528u4e8eu5206u6790
        )
        logger.debug(f"生成的可视化数据: {visualization_info}")
        
        # u8fd4u56deu683cu5f0fu5316u7684u6570u636e
        logger.info(f"查询成功执行，返回数据包含 {len(results)} 行和 {len(columns)} 列")
        return {
            "columns": columns,
            "rows": rows,
            "chartType": visualization_info.get("chartType", "bar"),
            "title": visualization_info.get("title", "u67e5u8be2u7ed3u679c"),
            "description": visualization_info.get("description", "")
        }
    
    except Exception as e:
        logger.error(f"执行查询时出错: {str(e)}")
        logger.error(f"错误详情: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"u5904u7406u53efu89c6u5316u6570u636eu65f6u51fau9519: {str(e)}"
        )
