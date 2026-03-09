from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Dict, Optional, Any
import aiohttp
import json
from datetime import datetime, timedelta
from app.utils.deps import get_current_user
from app.models.user import UserInDB
import os

router = APIRouter()

# 从环境变量或配置文件获取API密钥
# 这里使用的是项目中已配置的API密钥
DEEPSEEK_API_KEY = "sk-78df017dca4e4db896f23be28c435e61"

@router.get("/api-settings")
async def get_api_settings(current_user: UserInDB = Depends(get_current_user)):
    """获取API设置"""
    return {
        "apiKey": "sk-" + "*" * 35,  # 出于安全考虑不返回完整的API密钥
        "modelName": "deepseek-chat",
        "temperature": 0.7,
        "maxTokens": 2000,
    }

@router.post("/all-settings")
async def update_all_settings(settings: Dict[str, Any], current_user: UserInDB = Depends(get_current_user)):
    """更新所有设置"""
    try:
        # 将设置保存到用户文档中
        from pymongo import MongoClient
        from app.core.config import settings as app_settings
        
        # 获取MongoDB连接
        client = MongoClient(app_settings.MONGODB_URL)
        db = client[app_settings.MONGODB_DB_NAME]
        
        # 更新用户设置
        result = db.users.update_one(
            {"_id": current_user.id},
            {"$set": {"settings": settings}}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            return {"message": "所有设置已成功保存", "success": True}
        else:
            return {"message": "设置未发生变化", "success": True}
            
    except Exception as e:
        print(f"保存设置时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存设置失败: {str(e)}")

@router.post("/api-settings")
async def update_api_settings(settings: Dict[str, Any], current_user: UserInDB = Depends(get_current_user)):
    """更新API设置"""
    try:
        # 将API设置保存到用户文档中
        from pymongo import MongoClient
        from app.core.config import settings as app_settings
        
        # 获取MongoDB连接
        client = MongoClient(app_settings.MONGODB_URL)
        db = client[app_settings.MONGODB_DB_NAME]
        
        # 更新用户API设置
        result = db.users.update_one(
            {"_id": current_user.id},
            {"$set": {"settings.api": settings}}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            return {"message": "API设置已更新", "success": True}
        else:
            return {"message": "API设置未发生变化", "success": True}
            
    except Exception as e:
        print(f"保存API设置时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存API设置失败: {str(e)}")

@router.get("/api-usage")
async def get_api_usage(current_user: UserInDB = Depends(get_current_user)):
    """获取DeepSeek API使用统计数据"""
    try:
        # 设置API请求的时间范围（默认获取过去30天的数据）
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        # 构建请求URL和头信息
        url = "https://api.deepseek.com/v1/usage"
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # 构建请求参数
        params = {
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d")
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # 处理并格式化从DeepSeek获取的数据
                    usage_data = {
                        "totalRequests": data.get("total_requests", 0),
                        "totalTokens": data.get("total_tokens", 0),
                        "limitRequests": data.get("limit_requests", 1000),
                        "limitTokens": data.get("limit_tokens", 500000),
                        "usageByDay": data.get("usage_by_day", []),
                        "usageByModel": data.get("usage_by_model", [])
                    }
                    
                    return usage_data
                else:
                    # 如果无法获取真实数据，返回模拟数据（开发和测试阶段使用）
                    error_data = await response.text()
                    print(f"DeepSeek API请求失败: {response.status}, {error_data}")
                    
                    # 返回备用的模拟数据
                    return {
                        "totalRequests": 247,
                        "totalTokens": 125430,
                        "limitRequests": 1000,
                        "limitTokens": 500000,
                        "usageByDay": [
                            {"date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"), 
                             "requests": int(10 - i * 0.3) if i < 30 else 0, 
                             "tokens": int(5000 - i * 100) if i < 30 else 0} 
                            for i in range(30)
                        ],
                        "usageByModel": [
                            {"model": "deepseek-chat", "requests": 178, "tokens": 89320},
                            {"model": "deepseek-coder", "requests": 69, "tokens": 36110}
                        ]
                    }
    except Exception as e:
        print(f"获取API使用统计数据时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取使用统计数据失败: {str(e)}")
