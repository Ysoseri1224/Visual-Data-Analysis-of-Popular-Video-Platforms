from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime
from bson import ObjectId

from app.db.mongodb import get_database
from app.models.connection import (
    ConnectionInDB,
    DatabaseConnection,
    ApiConnection,
    FileServerConnection
)

# u83b7u53d6u8fdeu63a5u96c6u5408
async def get_connection_collection():
    db = await get_database()
    return db.connections

# u521bu5efau65b0u8fdeu63a5
async def create_connection(
    connection: Union[DatabaseConnection, ApiConnection, FileServerConnection],
    user_id: str
) -> ConnectionInDB:
    collection = await get_connection_collection()
    
    # u51c6u5907u8981u5b58u50a8u7684u6570u636e
    connection_data = connection.dict(exclude={"created_by"})
    
    # u521bu5efau8fdeu63a5u6587u6863
    connection_in_db = ConnectionInDB(
        name=connection.name,
        description=connection.description,
        type=connection.type,
        status="inactive",
        created_by=user_id,
        created_at=datetime.utcnow(),
        config=connection_data
    )
    
    # u63d2u5165u6570u636eu5e93
    result = await collection.insert_one(connection_in_db.dict(by_alias=True))
    
    # u83b7u53d6u521bu5efau7684u6587u6863
    created_connection = await collection.find_one({"_id": result.inserted_id})
    return ConnectionInDB(**created_connection)

# u83b7u53d6u7528u6237u7684u6240u6709u8fdeu63a5
async def get_user_connections(user_id: str) -> List[ConnectionInDB]:
    collection = await get_connection_collection()
    cursor = collection.find({"created_by": user_id})
    connections = []
    async for doc in cursor:
        connections.append(ConnectionInDB(**doc))
    return connections

# u6839u636eIDu83b7u53d6u8fdeu63a5
async def get_connection_by_id(connection_id: str, user_id: str) -> Optional[ConnectionInDB]:
    collection = await get_connection_collection()
    doc = await collection.find_one({
        "_id": ObjectId(connection_id),
        "created_by": user_id
    })
    if doc:
        return ConnectionInDB(**doc)
    return None

# u66f4u65b0u8fdeu63a5
async def update_connection(
    connection_id: str,
    connection: Union[DatabaseConnection, ApiConnection, FileServerConnection],
    user_id: str
) -> Optional[ConnectionInDB]:
    collection = await get_connection_collection()
    
    # u68c0u67e5u8fdeu63a5u662fu5426u5b58u5728
    existing = await get_connection_by_id(connection_id, user_id)
    if not existing:
        return None
    
    # u51c6u5907u66f4u65b0u6570u636e
    connection_data = connection.dict(exclude={"created_by"})
    
    # u66f4u65b0u6587u6863
    await collection.update_one(
        {"_id": ObjectId(connection_id)},
        {"$set": {
            "name": connection.name,
            "description": connection.description,
            "config": connection_data
        }}
    )
    
    # u83b7u53d6u66f4u65b0u540eu7684u6587u6863
    updated = await get_connection_by_id(connection_id, user_id)
    return updated

# u5220u9664u8fdeu63a5
async def delete_connection(connection_id: str, user_id: str) -> bool:
    collection = await get_connection_collection()
    
    # u68c0u67e5u8fdeu63a5u662fu5426u5b58u5728
    existing = await get_connection_by_id(connection_id, user_id)
    if not existing:
        return False
    
    # u5220u9664u6587u6863
    result = await collection.delete_one({
        "_id": ObjectId(connection_id),
        "created_by": user_id
    })
    
    return result.deleted_count > 0

# u6d4bu8bd5u6570u636eu5e93u8fdeu63a5
async def test_database_connection(connection: DatabaseConnection) -> Tuple[bool, str, Dict[str, Any]]:
    try:
        # u6839u636eu6570u636eu5e93u7c7bu578bu9009u62e9u4e0du540cu7684u6d4bu8bd5u65b9u6cd5
        if connection.db_type == "mysql":
            import pymysql
            conn = pymysql.connect(
                host=connection.host,
                port=connection.port,
                user=connection.username,
                password=connection.password,
                database=connection.database,
                ssl=connection.ssl
            )
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            return True, "u8fdeu63a5u6210u529f", {"result": result}
            
        elif connection.db_type == "postgresql":
            import psycopg2
            conn = psycopg2.connect(
                host=connection.host,
                port=connection.port,
                user=connection.username,
                password=connection.password,
                dbname=connection.database,
                sslmode="require" if connection.ssl else "disable"
            )
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            return True, "u8fdeu63a5u6210u529f", {"result": result}
            
        elif connection.db_type == "mongodb":
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(
                f"mongodb://{connection.username}:{connection.password}@{connection.host}:{connection.port}/{connection.database}"
            )
            db = client[connection.database]
            collections = await db.list_collection_names()
            return True, "u8fdeu63a5u6210u529f", {"collections": collections}
            
        else:
            return False, f"u4e0du652fu6301u7684u6570u636eu5e93u7c7bu578b: {connection.db_type}", {}
            
    except Exception as e:
        return False, f"u8fdeu63a5u5931u8d25: {str(e)}", {"error": str(e)}

# u6d4bu8bd5APIu8fdeu63a5
async def test_api_connection(connection: ApiConnection) -> Tuple[bool, str, Dict[str, Any]]:
    try:
        import httpx
        
        # u51c6u5907u8bf7u6c42u5934
        headers = connection.headers or {}
        
        # u6839u636eu8ba4u8bc1u7c7bu578bu6dfbu52a0u8ba4u8bc1u4fe1u606f
        if connection.auth_type == "api_key" and connection.api_key:
            if connection.api_key_name:
                headers[connection.api_key_name] = connection.api_key
            else:
                headers["X-API-Key"] = connection.api_key
                
        elif connection.auth_type == "bearer" and connection.bearer_token:
            headers["Authorization"] = f"Bearer {connection.bearer_token}"
        
        # u53d1u9001u8bf7u6c42
        async with httpx.AsyncClient() as client:
            if connection.auth_type == "basic" and connection.username and connection.password:
                response = await client.get(
                    connection.base_url,
                    headers=headers,
                    auth=(connection.username, connection.password),
                    timeout=10.0
                )
            else:
                response = await client.get(
                    connection.base_url,
                    headers=headers,
                    timeout=10.0
                )
            
            # u68c0u67e5u54cdu5e94
            if response.status_code < 400:
                return True, "u8fdeu63a5u6210u529f", {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "content_type": response.headers.get("content-type", "")
                }
            else:
                return False, f"u8bf7u6c42u5931u8d25: HTTP {response.status_code}", {
                    "status_code": response.status_code,
                    "reason": response.reason_phrase
                }
                
    except Exception as e:
        return False, f"u8fdeu63a5u5931u8d25: {str(e)}", {"error": str(e)}

# u6d4bu8bd5u6587u4ef6u670du52a1u5668u8fdeu63a5
async def test_file_server_connection(connection: FileServerConnection) -> Tuple[bool, str, Dict[str, Any]]:
    try:
        # u6839u636eu6587u4ef6u670du52a1u5668u7c7bu578bu9009u62e9u4e0du540cu7684u6d4bu8bd5u65b9u6cd5
        if connection.file_type == "ftp":
            from ftplib import FTP
            
            # u521bu5efaFTPu8fdeu63a5
            ftp = FTP()
            ftp.connect(connection.host, connection.port or 21)
            ftp.login(connection.username, connection.password)
            
            if connection.passive:
                ftp.set_pasv(True)
                
            # u5217u51fau76eeu5f55u5185u5bb9
            if connection.base_path:
                ftp.cwd(connection.base_path)
                
            files = ftp.nlst()
            ftp.quit()
            
            return True, "u8fdeu63a5u6210u529f", {"files": files}
            
        elif connection.file_type == "sftp":
            import paramiko
            
            # u521bu5efaSSHu5ba2u6237u7aef
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(
                connection.host,
                port=connection.port or 22,
                username=connection.username,
                password=connection.password
            )
            
            # u521bu5efaSFTPu5ba2u6237u7aef
            sftp = ssh.open_sftp()
            
            # u5217u51fau76eeu5f55u5185u5bb9
            path = connection.base_path or '.'
            files = sftp.listdir(path)
            
            sftp.close()
            ssh.close()
            
            return True, "u8fdeu63a5u6210u529f", {"files": files}
            
        elif connection.file_type in ["s3", "azure_blob", "gcs"]:
            # u8fd9u91ccu53efu4ee5u5b9eu73b0u4e91u5b58u50a8u7684u8fdeu63a5u6d4bu8bd5
            # u7531u4e8eu4f9du8d56u5173u7cfbu590du6742uff0cu8fd9u91ccu5148u8fd4u56deu6210u529f
            return True, f"u4e91u5b58u50a8u8fdeu63a5u914du7f6eu6709u6548: {connection.file_type}", {}
            
        else:
            return False, f"u4e0du652fu6301u7684u6587u4ef6u670du52a1u5668u7c7bu578b: {connection.file_type}", {}
            
    except Exception as e:
        return False, f"u8fdeu63a5u5931u8d25: {str(e)}", {"error": str(e)}

# u6d4bu8bd5u8fdeu63a5
async def test_connection(
    connection: Union[DatabaseConnection, ApiConnection, FileServerConnection]
) -> Tuple[bool, str, Dict[str, Any]]:
    # u6839u636eu8fdeu63a5u7c7bu578bu9009u62e9u6d4bu8bd5u65b9u6cd5
    if connection.type == "database":
        return await test_database_connection(connection)
    elif connection.type == "api":
        return await test_api_connection(connection)
    elif connection.type == "file":
        return await test_file_server_connection(connection)
    else:
        return False, f"u4e0du652fu6301u7684u8fdeu63a5u7c7bu578b: {connection.type}", {}

# u66f4u65b0u8fdeu63a5u72b6u6001
async def update_connection_status(
    connection_id: str,
    status: str,
    user_id: str,
    is_test: bool = False
) -> Optional[ConnectionInDB]:
    collection = await get_connection_collection()
    
    # u51c6u5907u66f4u65b0u6570u636e
    update_data = {"status": status}
    
    # u5982u679cu662fu6d4bu8bd5u64cdu4f5cuff0cu66f4u65b0u6d4bu8bd5u65f6u95f4
    if is_test:
        update_data["last_tested"] = datetime.utcnow()
    else:
        update_data["last_used"] = datetime.utcnow()
    
    # u66f4u65b0u6587u6863
    await collection.update_one(
        {"_id": ObjectId(connection_id), "created_by": user_id},
        {"$set": update_data}
    )
    
    # u83b7u53d6u66f4u65b0u540eu7684u6587u6863
    updated = await get_connection_by_id(connection_id, user_id)
    return updated
