from fastapi import APIRouter, Depends, Query, HTTPException, status, Body
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.utils.deps import get_current_user, get_current_admin
from app.db.mongodb import get_database
from app.models.user import UserInDB
from app.models.log import LogEntry, LogLevel, LogSource
from app.services.log_service import get_logs, export_logs_to_csv, add_log_entry
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel, Field

router = APIRouter()

@router.get("/admin/logs")
async def get_system_logs(
    current_user: UserInDB = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search_term: Optional[str] = None,
):
    """获取系统日志，仅管理员可访问"""
    
    # 处理日期过滤
    start_datetime = None
    end_datetime = None
    
    if start_date:
        try:
            start_datetime = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式无效")
    
    if end_date:
        try:
            end_datetime = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式无效")
    
    # 获取日志
    logs, total_pages = await get_logs(
        page=page,
        limit=limit,
        level=level,
        source=source,
        start_date=start_datetime,
        end_date=end_datetime,
        search_term=search_term
    )
    
    return {
        "logs": logs,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/admin/logs/export")
async def export_logs(
    current_user: UserInDB = Depends(get_current_admin),
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search_term: Optional[str] = None,
):
    """导出日志为CSV，仅管理员可访问"""
    
    # 处理日期过滤
    start_datetime = None
    end_datetime = None
    
    if start_date:
        try:
            start_datetime = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式无效")
    
    if end_date:
        try:
            end_datetime = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式无效")
    
    # 生成CSV
    csv_content = await export_logs_to_csv(
        level=level,
        source=source,
        start_date=start_datetime,
        end_date=end_datetime,
        search_term=search_term
    )
    
    # 创建响应
    response = StreamingResponse(
        iter([csv_content]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return response

# 定义前端日志数据模型
class LogData(BaseModel):
    level: str = Field(..., description="日志级别: info, warning, error")
    source: str = Field(..., description="日志来源模块: 对话模块, 数据可视化模块, 数据管理模块")
    message: str = Field(..., description="日志消息")
    details: Optional[str] = Field(None, description="详细信息")
    userId: Optional[str] = Field(None, description="用户ID")

@router.post("/logs")
async def create_frontend_log(
    log_data: LogData,
    current_user: Optional[UserInDB] = Depends(get_current_user),
):
    """记录前端日志信息，用户需登录但不需要管理员权限"""
    
    try:
        # 转换前端日志为后端格式
        details_dict = {"frontend_details": log_data.details} if log_data.details else {}
        
        # 使用当前登录用户ID或前端传入的ID
        user_id = current_user.id if current_user else log_data.userId
        
        log_id = await add_log_entry(
            level=log_data.level,
            source=log_data.source,
            message=log_data.message,
            user_id=user_id,
            details=details_dict
        )
        return {"status": "success", "log_id": log_id}
    except Exception as e:
        # 记录错误但不阻止前端操作
        print(f"记录前端日志失败: {str(e)}")
        return {"status": "error", "message": f"记录日志失败: {str(e)}"}

@router.post("/admin/logs")
async def create_admin_log(
    log_data: dict,
    current_user: UserInDB = Depends(get_current_admin),
):
    """创建日志条目，仅管理员可访问"""
    
    try:
        log_id = await add_log_entry(
            level=log_data.get("level", "info"),
            source=log_data.get("source", "system"),
            message=log_data.get("message", ""),
            user_id=log_data.get("user_id", current_user.id),
            details=log_data.get("details", {})
        )
        return {"status": "success", "log_id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建日志失败: {str(e)}")
