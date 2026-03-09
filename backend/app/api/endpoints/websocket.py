from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
import json
import asyncio
import uuid
from datetime import datetime

from app.core.security import get_current_user_ws
from app.models.user import UserInDB as User
from app.services.deepseek_service import generate_response, generate_streaming_response
from app.schemas.message import MessageCreate, MessageResponse
from app.crud.conversation import create_conversation, add_message_to_conversation

router = APIRouter()

# 连接管理器
class ConnectionManager:
    def __init__(self):
        # 活跃连接 {client_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # 用户ID到客户端ID的映射 {user_id: [client_id1, client_id2, ...]}
        self.user_connections: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, client_id: str, user_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(client_id)

    def disconnect(self, client_id: str, user_id: Optional[str] = None):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        if user_id and user_id in self.user_connections:
            if client_id in self.user_connections[user_id]:
                self.user_connections[user_id].remove(client_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_message(self, client_id: str, message: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

    async def broadcast_to_user(self, user_id: str, message: str):
        if user_id in self.user_connections:
            for client_id in self.user_connections[user_id]:
                await self.send_message(client_id, message)

manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")
                content = message_data.get("content")
                conversation_id = message_data.get("conversation_id")
                
                if message_type == "message":
                    # 处理普通消息
                    response = await process_message(client_id, content, conversation_id)
                    await manager.send_message(client_id, json.dumps(response))
                elif message_type == "stream_message":
                    # 处理流式消息
                    await process_stream_message(client_id, content, conversation_id, websocket)
                else:
                    # 未知消息类型
                    await manager.send_message(
                        client_id, 
                        json.dumps({"type": "error", "content": "未知消息类型"})
                    )
            except json.JSONDecodeError:
                await manager.send_message(
                    client_id, 
                    json.dumps({"type": "error", "content": "无效的JSON格式"})
                )
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@router.websocket("/ws/auth/{client_id}")
async def authenticated_websocket_endpoint(websocket: WebSocket, client_id: str):
    user = None
    try:
        # 尝试获取当前用户
        user = await get_current_user_ws(websocket)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        await manager.connect(websocket, client_id, str(user.id))
        
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")
                content = message_data.get("content")
                conversation_id = message_data.get("conversation_id")
                
                if message_type == "message":
                    # 处理普通消息
                    response = await process_message(client_id, content, conversation_id, user)
                    await manager.send_message(client_id, json.dumps(response))
                elif message_type == "stream_message":
                    # 处理流式消息
                    await process_stream_message(client_id, content, conversation_id, websocket, user)
                else:
                    # 未知消息类型
                    await manager.send_message(
                        client_id, 
                        json.dumps({"type": "error", "content": "未知消息类型"})
                    )
            except json.JSONDecodeError:
                await manager.send_message(
                    client_id, 
                    json.dumps({"type": "error", "content": "无效的JSON格式"})
                )
    except WebSocketDisconnect:
        if user:
            manager.disconnect(client_id, str(user.id))
        else:
            manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket错误: {str(e)}")
        if user:
            manager.disconnect(client_id, str(user.id))
        else:
            manager.disconnect(client_id)

async def process_message(client_id: str, content: str, conversation_id: Optional[str] = None, user: Optional[User] = None) -> Dict[str, Any]:
    """
    处理普通消息
    """
    try:
        # 生成回复
        response_content = await generate_response(content)
        
        # 创建响应数据
        timestamp = datetime.now().isoformat()
        message_id = str(uuid.uuid4())
        
        # 如果用户已登录且提供了conversation_id，则保存消息到数据库
        if user and conversation_id:
            # 创建用户消息
            user_message = MessageCreate(
                content=content,
                role="user",
                conversation_id=conversation_id
            )
            # 创建系统回复
            system_message = MessageCreate(
                content=response_content,
                role="assistant",
                conversation_id=conversation_id
            )
            
            # 保存消息到数据库
            await add_message_to_conversation(conversation_id, user_message)
            await add_message_to_conversation(conversation_id, system_message)
        
        return {
            "type": "message",
            "id": message_id,
            "content": response_content,
            "timestamp": timestamp,
            "conversation_id": conversation_id
        }
    except Exception as e:
        return {
            "type": "error",
            "content": f"处理消息时出错: {str(e)}"
        }

async def process_stream_message(client_id: str, content: str, conversation_id: Optional[str] = None, websocket: WebSocket = None, user: Optional[User] = None):
    """
    处理流式消息
    """
    try:
        # 发送开始标记
        message_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        await websocket.send_text(json.dumps({
            "type": "stream_start",
            "id": message_id,
            "timestamp": timestamp,
            "conversation_id": conversation_id
        }))
        
        # 如果用户已登录且提供了conversation_id，则保存用户消息到数据库
        if user and conversation_id:
            # 创建用户消息
            user_message = MessageCreate(
                content=content,
                role="user",
                conversation_id=conversation_id
            )
            # 保存用户消息到数据库
            await add_message_to_conversation(conversation_id, user_message)
        
        # 完整的响应内容
        full_response = ""
        
        # 生成流式回复
        async for chunk in generate_streaming_response(content):
            full_response += chunk
            await websocket.send_text(json.dumps({
                "type": "stream_chunk",
                "id": message_id,
                "content": chunk,
                "timestamp": datetime.now().isoformat(),
                "conversation_id": conversation_id
            }))
            await asyncio.sleep(0.01)  # 添加小延迟，避免过快发送
        
        # 如果用户已登录且提供了conversation_id，则保存系统回复到数据库
        if user and conversation_id:
            # 创建系统回复
            system_message = MessageCreate(
                content=full_response,
                role="assistant",
                conversation_id=conversation_id
            )
            # 保存系统回复到数据库
            await add_message_to_conversation(conversation_id, system_message)
        
        # 发送结束标记
        await websocket.send_text(json.dumps({
            "type": "stream_end",
            "id": message_id,
            "timestamp": datetime.now().isoformat(),
            "conversation_id": conversation_id
        }))
    except Exception as e:
        await websocket.send_text(json.dumps({
            "type": "error",
            "content": f"处理流式消息时出错: {str(e)}"
        }))
