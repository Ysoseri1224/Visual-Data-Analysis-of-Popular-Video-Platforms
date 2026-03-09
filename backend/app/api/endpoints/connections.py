from typing import List, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from bson.errors import InvalidId

from app.api.endpoints.auth import get_current_user
from app.models.user import UserInDB
from app.models.connection import (
    ConnectionBase,
    DatabaseConnection,
    ApiConnection,
    FileServerConnection,
    ConnectionResponse,
    ConnectionTestResponse
)
from app.services.connection_service import (
    create_connection,
    get_user_connections,
    get_connection_by_id,
    update_connection,
    delete_connection,
    test_connection,
    update_connection_status
)

router = APIRouter()

@router.post("/", response_model=ConnectionResponse)
async def create_new_connection(
    connection_type: str,
    database: Optional[DatabaseConnection] = None,
    api: Optional[ApiConnection] = None,
    file_server: Optional[FileServerConnection] = None,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    创建新的连接
    """
    # 根据连接类型选择连接配置
    if connection_type == "database" and database:
        conn = database
    elif connection_type == "api" and api:
        conn = api
    elif connection_type == "file" and file_server:
        conn = file_server
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的连接类型或连接配置: {connection_type}"
        )
    
    # 创建连接
    connection_in_db = await create_connection(conn, current_user.id)
    
    # 返回连接信息
    return {
        "id": str(connection_in_db.id),
        "name": connection_in_db.name,
        "description": connection_in_db.description,
        "type": connection_in_db.type,
        "status": connection_in_db.status,
        "created_at": connection_in_db.created_at,
        "last_used": connection_in_db.last_used,
        "config": connection_in_db.config
    }

@router.get("/", response_model=List[ConnectionResponse])
async def get_connections(
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    获取用户的所有连接
    """
    connections = await get_user_connections(current_user.id)
    
    # 返回连接信息列表
    return [
        {
            "id": str(conn.id),
            "name": conn.name,
            "description": conn.description,
            "type": conn.type,
            "status": conn.status,
            "created_at": conn.created_at,
            "last_used": conn.last_used,
            "config": conn.config
        }
        for conn in connections
    ]

@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(
    connection_id: str,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    获取指定连接
    """
    try:
        connection = await get_connection_by_id(connection_id, current_user.id)
        if not connection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="连接不存在"
            )
        
        # 返回连接信息
        return {
            "id": str(connection.id),
            "name": connection.name,
            "description": connection.description,
            "type": connection.type,
            "status": connection.status,
            "created_at": connection.created_at,
            "last_used": connection.last_used,
            "config": connection.config
        }
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的连接ID"
        )

@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_existing_connection(
    connection_id: str,
    connection_type: str,
    database: Optional[DatabaseConnection] = None,
    api: Optional[ApiConnection] = None,
    file_server: Optional[FileServerConnection] = None,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    更新现有连接
    """
    try:
        # 检查连接是否存在
        existing = await get_connection_by_id(connection_id, current_user.id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="连接不存在"
            )
        
        # 根据连接类型选择连接配置
        if connection_type == "database" and database:
            conn = database
        elif connection_type == "api" and api:
            conn = api
        elif connection_type == "file" and file_server:
            conn = file_server
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的连接类型或连接配置: {connection_type}"
            )
        
        # 更新连接
        updated = await update_connection(connection_id, conn, current_user.id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="连接不存在或无权更新"
            )
        
        # 返回连接信息
        return {
            "id": str(updated.id),
            "name": updated.name,
            "description": updated.description,
            "type": updated.type,
            "status": updated.status,
            "created_at": updated.created_at,
            "last_used": updated.last_used,
            "config": updated.config
        }
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的连接ID"
        )

@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_connection(
    connection_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    删除连接
    """
    try:
        # 检查连接是否存在
        connection = await get_connection_by_id(connection_id, current_user.id)
        if not connection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="连接不存在"
            )
            
        # 删除连接
        await delete_connection(connection_id, current_user.id)
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的连接ID格式"
        )

@router.post("/test", response_model=ConnectionTestResponse)
async def test_new_connection(
    connection_type: str,
    database: Optional[DatabaseConnection] = None,
    api: Optional[ApiConnection] = None,
    file_server: Optional[FileServerConnection] = None,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    测试新的连接
    """
    # 根据连接类型选择连接配置
    if connection_type == "database" and database:
        conn = database
    elif connection_type == "api" and api:
        conn = api
    elif connection_type == "file" and file_server:
        conn = file_server
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的连接类型或连接配置: {connection_type}"
        )
    
    # 测试连接
    success, message, details = await test_connection(conn)
    
    return {
        "success": success,
        "message": message,
        "details": details
    }

@router.post("/{connection_id}/test", response_model=ConnectionTestResponse)
async def test_existing_connection(
    connection_id: str,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    测试现有连接
    """
    try:
        # 获取连接
        connection = await get_connection_by_id(connection_id, current_user.id)
        if not connection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="连接不存在"
            )
        
        # 根据连接类型选择连接配置
        config = connection.config
        if connection.type == "database":
            conn = DatabaseConnection(**config)
        elif connection.type == "api":
            conn = ApiConnection(**config)
        elif connection.type == "file":
            conn = FileServerConnection(**config)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的连接类型: {connection.type}"
            )
        
        # 测试连接
        success, message, details = await test_connection(conn)
        
        # 更新连接状态
        status_value = "active" if success else "error"
        await update_connection_status(connection_id, status_value, current_user.id, True)
        
        return {
            "success": success,
            "message": message,
            "details": details
        }
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的连接ID"
        )
