from fastapi import BackgroundTasks
from typing import List, Dict, Any, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
from pymongo import MongoClient
from app.core.config import settings as app_settings

logger = logging.getLogger(__name__)

class NotificationService:
    """通知服务 - 处理系统中的所有通知类型"""
    
    def __init__(self):
        """初始化通知服务"""
        self.smtp_server = app_settings.SMTP_SERVER
        self.smtp_port = app_settings.SMTP_PORT
        self.smtp_username = app_settings.SMTP_USERNAME
        self.smtp_password = app_settings.SMTP_PASSWORD
        self.smtp_sender = app_settings.SMTP_SENDER
    
    async def get_notification_enabled_users(self, notification_type: str) -> List[Dict[str, Any]]:
        """获取启用了指定通知类型的用户列表"""
        try:
            client = MongoClient(app_settings.MONGODB_URL)
            db = client[app_settings.MONGODB_DB_NAME]
            
            # 查找启用了指定通知类型的用户
            query = {
                f"settings.notifications.{notification_type}": True,
                "settings.notifications.email": True  # 只有启用了邮件通知的用户
            }
            
            users = list(db.users.find(query))
            return users
        except Exception as e:
            logger.error(f"获取启用通知的用户失败: {str(e)}")
            return []
        finally:
            if 'client' in locals():
                client.close()
    
    async def send_email_notification(
        self,
        background_tasks: BackgroundTasks,
        recipient: str,
        subject: str,
        content: str,
        html_content: Optional[str] = None
    ) -> bool:
        """发送邮件通知"""
        # 将邮件发送任务添加到后台任务
        background_tasks.add_task(
            self._send_email_task,
            recipient,
            subject,
            content,
            html_content
        )
        return True
    
    def _send_email_task(
        self,
        recipient: str,
        subject: str,
        content: str,
        html_content: Optional[str] = None
    ) -> bool:
        """实际发送邮件的后台任务"""
        try:
            # 创建邮件
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_sender
            msg['To'] = recipient
            
            # 添加纯文本内容
            text_part = MIMEText(content, 'plain', 'utf-8')
            msg.attach(text_part)
            
            # 如果提供了HTML内容，也添加HTML版本
            if html_content:
                html_part = MIMEText(html_content, 'html', 'utf-8')
                msg.attach(html_part)
            
            # 连接SMTP服务器并发送邮件
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # 启用TLS加密
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"邮件发送成功: {subject} 到 {recipient}")
            return True
        except Exception as e:
            logger.error(f"邮件发送失败: {str(e)}")
            return False
    
    async def notify_system_update(
        self,
        background_tasks: BackgroundTasks,
        version: str,
        update_details: str,
        update_date: str
    ) -> int:
        """通知系统更新"""
        users = await self.get_notification_enabled_users('systemUpdates')
        sent_count = 0
        
        subject = f"系统更新通知 - 版本 {version}"
        
        text_content = f"""
尊敬的用户，

我们的系统已更新到版本 {version}。

更新内容:
{update_details}

更新时间: {update_date}

此致，
StarData 团队
        """
        
        html_content = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #3b82f6;">系统更新通知</h2>
    <p>尊敬的用户，</p>
    <p>我们的系统已更新到版本 <strong>{version}</strong>。</p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #0f172a;">更新内容:</h3>
        <p style="white-space: pre-line;">{update_details}</p>
        <p style="color: #64748b;">更新时间: {update_date}</p>
    </div>
    
    <p>感谢您使用StarData！</p>
    <p>此致，<br/>StarData 团队</p>
</div>
        """
        
        for user in users:
            if 'email' in user and user['email']:
                success = await self.send_email_notification(
                    background_tasks,
                    user['email'],
                    subject,
                    text_content,
                    html_content
                )
                if success:
                    sent_count += 1
        
        return sent_count
    
    async def notify_new_feature(
        self,
        background_tasks: BackgroundTasks,
        feature_name: str,
        feature_description: str,
        feature_image_url: Optional[str] = None
    ) -> int:
        """通知新功能发布"""
        users = await self.get_notification_enabled_users('newFeatures')
        sent_count = 0
        
        subject = f"新功能发布: {feature_name}"
        
        text_content = f"""
尊敬的用户，

我们很高兴地宣布一项新功能: {feature_name}

功能详情:
{feature_description}

我们希望这项新功能能够提升您的使用体验。

此致，
StarData 团队
        """
        
        image_html = ""
        if feature_image_url:
            image_html = f'<img src="{feature_image_url}" alt="{feature_name}" style="max-width: 100%; border-radius: 5px; margin: 15px 0;" />'
        
        html_content = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #3b82f6;">新功能发布</h2>
    <p>尊敬的用户，</p>
    <p>我们很高兴地宣布一项新功能: <strong>{feature_name}</strong></p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #0f172a;">功能详情:</h3>
        <p style="white-space: pre-line;">{feature_description}</p>
        {image_html}
    </div>
    
    <p>我们希望这项新功能能够提升您的使用体验。</p>
    <p>此致，<br/>StarData 团队</p>
</div>
        """
        
        for user in users:
            if 'email' in user and user['email']:
                success = await self.send_email_notification(
                    background_tasks,
                    user['email'],
                    subject,
                    text_content,
                    html_content
                )
                if success:
                    sent_count += 1
        
        return sent_count
    
    async def notify_usage_reminder(
        self,
        background_tasks: BackgroundTasks,
        reminder_message: str,
        days_inactive: int
    ) -> int:
        """发送使用提醒"""
        users = await self.get_notification_enabled_users('usageReminders')
        sent_count = 0
        
        subject = "StarData使用提醒"
        
        text_content = f"""
尊敬的用户，

我们注意到您已有{days_inactive}天未登录StarData。

{reminder_message}

期待您的回归！

此致，
StarData 团队
        """
        
        html_content = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #3b82f6;">使用提醒</h2>
    <p>尊敬的用户，</p>
    <p>我们注意到您已有<strong>{days_inactive}天</strong>未登录StarData。</p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="white-space: pre-line;">{reminder_message}</p>
    </div>
    
    <p>期待您的回归！</p>
    <p>此致，<br/>StarData 团队</p>
    
    <p style="font-size: 12px; color: #64748b; margin-top: 30px;">
        如果您不想再收到此类提醒，可以在设置页面中关闭"使用提醒"选项。
    </p>
</div>
        """
        
        for user in users:
            if 'email' in user and user['email']:
                success = await self.send_email_notification(
                    background_tasks,
                    user['email'],
                    subject,
                    text_content,
                    html_content
                )
                if success:
                    sent_count += 1
        
        return sent_count
    
    async def test_email_notification(
        self,
        background_tasks: BackgroundTasks,
        email: str
    ) -> bool:
        """测试邮件通知功能"""
        subject = "StarData通知测试"
        
        text_content = """
这是一封测试邮件，用于验证StarData的通知系统是否正常工作。

如果您收到此邮件，说明通知系统工作正常。

此致，
StarData 团队
        """
        
        html_content = """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #3b82f6;">通知测试</h2>
    <p>这是一封测试邮件，用于验证StarData的通知系统是否正常工作。</p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p>如果您收到此邮件，说明通知系统工作正常。</p>
    </div>
    
    <p>此致，<br/>StarData 团队</p>
</div>
        """
        
        return await self.send_email_notification(
            background_tasks,
            email,
            subject,
            text_content,
            html_content
        )

# 创建通知服务实例
notification_service = NotificationService()
