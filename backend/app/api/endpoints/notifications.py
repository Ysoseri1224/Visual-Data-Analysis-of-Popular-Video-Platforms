from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from typing import Dict, Any, List

from app.models.user import UserInDB
from app.utils.deps import get_current_user
from app.services.notification_service import notification_service
from app.core.config import settings as app_settings

router = APIRouter()

@router.post("/test-email")
async def test_email_notification(
    background_tasks: BackgroundTasks,
    current_user: UserInDB = Depends(get_current_user)
):
    """测试邮件通知功能"""
    if not current_user.email:
        raise HTTPException(status_code=400, detail="用户邮箱未设置")
    
    success = await notification_service.test_email_notification(
        background_tasks,
        current_user.email
    )
    
    if success:
        return {"success": True, "message": "测试邮件已发送，请检查您的邮箱"}
    else:
        raise HTTPException(status_code=500, detail="邮件发送失败")

@router.post("/system-update")
async def send_system_update_notification(
    background_tasks: BackgroundTasks,
    update_data: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """发送系统更新通知（仅管理员可用）"""
    # 检查用户权限
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权执行此操作")
    
    sent_count = await notification_service.notify_system_update(
        background_tasks,
        version=update_data.get("version", "未知版本"),
        update_details=update_data.get("details", ""),
        update_date=update_data.get("date", "")
    )
    
    return {"success": True, "sent_count": sent_count}

@router.post("/new-feature")
async def send_new_feature_notification(
    background_tasks: BackgroundTasks,
    feature_data: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """发送新功能通知（仅管理员可用）"""
    # 检查用户权限
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权执行此操作")
    
    sent_count = await notification_service.notify_new_feature(
        background_tasks,
        feature_name=feature_data.get("name", "新功能"),
        feature_description=feature_data.get("description", ""),
        feature_image_url=feature_data.get("image_url")
    )
    
    return {"success": True, "sent_count": sent_count}

@router.post("/usage-reminder")
async def send_usage_reminder(
    background_tasks: BackgroundTasks,
    reminder_data: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """发送使用提醒通知（仅管理员可用）"""
    # 检查用户权限
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权执行此操作")
    
    sent_count = await notification_service.notify_usage_reminder(
        background_tasks,
        reminder_message=reminder_data.get("message", ""),
        days_inactive=reminder_data.get("days_inactive", 30)
    )
    
    return {"success": True, "sent_count": sent_count}
