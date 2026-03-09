from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
async def check_health() -> Dict[str, Any]:
    """
    健康检查端点，用于前端检测后端服务状态
    """
    try:
        return {
            "status": "ok",
            "message": "服务正常运行"
        }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务异常")
