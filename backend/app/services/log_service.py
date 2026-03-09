from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import csv
import io
from app.db.mongodb import get_database
from bson import ObjectId
import math

async def get_logs(
    page: int = 1,
    limit: int = 50,
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search_term: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], int]:
    """
    获取系统日志，支持分页和筛选
    """
    db = await get_database()
    logs_collection = db.logs
    
    # 构建查询条件
    query = {}
    
    if level:
        query["level"] = level
    
    if source:
        query["source"] = source
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        
        if date_query:
            query["timestamp"] = date_query
    
    if search_term:
        query["$or"] = [
            {"message": {"$regex": search_term, "$options": "i"}},
            {"details.context": {"$regex": search_term, "$options": "i"}}
        ]
    
    # 计算总数和总页数
    total_logs = await logs_collection.count_documents(query)
    total_pages = math.ceil(total_logs / limit)
    
    # 获取指定页面的日志
    cursor = logs_collection.find(query)
    cursor.sort("timestamp", -1)  # 按时间降序排序
    cursor.skip((page - 1) * limit)
    cursor.limit(limit)
    
    logs = []
    async for log in cursor:
        log["_id"] = str(log["_id"])
        
        # 处理数值，确保最多保留2位小数
        for key, value in log.get("details", {}).items():
            if isinstance(value, float):
                log["details"][key] = round(value, 2)
        
        logs.append(log)
    
    return logs, total_pages

async def export_logs_to_csv(
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search_term: Optional[str] = None
) -> str:
    """
    导出日志为CSV格式
    """
    # 获取所有符合条件的日志（不分页）
    logs, _ = await get_logs(
        page=1,
        limit=10000,  # 设置一个较大的限制
        level=level,
        source=source,
        start_date=start_date,
        end_date=end_date,
        search_term=search_term
    )
    
    # 创建CSV文件
    output = io.StringIO()
    fieldnames = ["ID", "时间", "级别", "来源", "消息", "用户ID", "详情"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for log in logs:
        # 处理详情中的浮点数
        details_str = ""
        if "details" in log and log["details"]:
            details_dict = {}
            for key, value in log["details"].items():
                if isinstance(value, float):
                    details_dict[key] = f"{value:.2f}"
                else:
                    details_dict[key] = value
            details_str = str(details_dict)
        
        writer.writerow({
            "ID": log["_id"],
            "时间": log["timestamp"].isoformat() if isinstance(log["timestamp"], datetime) else log["timestamp"],
            "级别": log["level"],
            "来源": log["source"],
            "消息": log["message"],
            "用户ID": log.get("user_id", ""),
            "详情": details_str
        })
    
    return output.getvalue()

async def add_log_entry(
    level: str,
    source: str,
    message: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> str:
    """
    添加日志条目
    """
    db = await get_database()
    logs_collection = db.logs
    
    # 处理details中的浮点数，确保最多保留2位小数
    if details:
        for key, value in details.items():
            if isinstance(value, float):
                details[key] = round(value, 2)
    
    log_entry = {
        "timestamp": datetime.now(),
        "level": level,
        "source": source,
        "message": message,
        "user_id": user_id,
        "details": details or {}
    }
    
    result = await logs_collection.insert_one(log_entry)
    return str(result.inserted_id)
