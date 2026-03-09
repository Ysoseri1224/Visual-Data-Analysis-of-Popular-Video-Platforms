from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, status, UploadFile
from pydantic import BaseModel
import os
import datetime
import json
import csv
import pandas as pd
import re
import sqlalchemy
from sqlalchemy import create_engine, text, Column, String, Integer, Float, DateTime, MetaData, Table
import traceback
import time
from typing import Any, Dict, List, Optional, Union

from app.api.endpoints.auth import get_current_user
from app.models.user import UserInDB

# 上传文件保存目录
UPLOAD_DIR = "upload"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# MySQL连接配置
# 使用简化的配置并添加错误检查
MYSQL_CONNECTION_STRING = "mysql+pymysql://root:123456@localhost:3306/"

# 初始化数据库引擎
def get_db_engine():
    try:
        # 先创建没有数据库名称的连接
        print(f"初始连接到MySQL: {MYSQL_CONNECTION_STRING}")
        engine = create_engine(MYSQL_CONNECTION_STRING, isolation_level="AUTOCOMMIT")
        
        # 检查并创建 media_crawler 数据库
        with engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS media_crawler"))
            print("media_crawler 数据库已存在或刚创建成功")
        
        # 返回包含数据库名称的连接
        return create_engine(f"{MYSQL_CONNECTION_STRING}media_crawler")
    except Exception as e:
        error_msg = f"MySQL连接或创建数据库失败: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        raise Exception(error_msg)

DB_ENGINE = get_db_engine()

class ImportRequest(BaseModel):
    filename: str
    primary_key: Optional[str] = None

class ColumnInfo(BaseModel):
    name: str
    type: str
    sample_values: List[Any]
    is_likely_primary_key: bool = False

class FileAnalysisResponse(BaseModel):
    columns: List[ColumnInfo]
    suggested_primary_key: Optional[str] = None
    total_rows: int
    preview_rows: List[Dict[str, Any]]

router = APIRouter()

class NaturalLanguageQuery(BaseModel):
    query: str

class SQLQuery(BaseModel):
    query: str

class QueryResponse(BaseModel):
    natural_language: str
    sql_query: str
    results: List[Dict[str, Any]]
    visualization_data: Dict[str, Any]

class DatabaseStatsRequest(BaseModel):
    database: str = "media_crawler"

class DatabaseStats(BaseModel):
    database: str
    tableCount: int
    recordCount: int
    storageSize: str

@router.get("/tables")
async def get_database_tables(current_user: UserInDB = Depends(get_current_user)):
    """
    获取数据库中的所有表
    """
    try:
        conn = DB_ENGINE.connect()
        try:
            # 使用SQL查询获取所有表
            result = conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result]
            return {"tables": tables}
        finally:
            conn.close()
    except Exception as e:
        print(f"获取数据库表列表失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取表列表失败: {str(e)}"
        )

@router.post("/convert")
def convert_nl_to_sql(
    nl_query: NaturalLanguageQuery,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    将自然语言转换为SQL查询
    """
    # 这里是简单的演示实现
    query_text = nl_query.query.lower()
    
    if "show all" in query_text or "list all" in query_text:
        sql = "SELECT * FROM videos LIMIT 100"
    elif "top 10" in query_text or "top ten" in query_text:
        sql = "SELECT * FROM videos ORDER BY view_count DESC LIMIT 10"
    elif "average views" in query_text or "avg views" in query_text:
        sql = "SELECT AVG(view_count) as average_views FROM videos"
    else:
        sql = "SELECT * FROM videos LIMIT 10"
    
    return {
        "natural_language": nl_query.query,
        "sql_query": sql
    }

@router.get("/tables/{table_name}")
async def get_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    获取指定表的数据，支持分页
    """
    try:
        # 验证表名是否合法，防止SQL注入
        if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的表名"
            )
        
        conn = DB_ENGINE.connect()
        try:
            # 首先检查表是否存在
            result = conn.execute(text(f"SHOW TABLES LIKE '{table_name}'"))
            if not result.first():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"表 {table_name} 不存在"
                )
            
            # 查询表的总行数
            result = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`"))
            total_count = result.scalar()
            
            # 计算总页数
            total_pages = (total_count + page_size - 1) // page_size
            
            # 查询当前页的数据
            offset = (page - 1) * page_size
            result = conn.execute(text(f"SELECT * FROM `{table_name}` LIMIT {page_size} OFFSET {offset}"))
            
            # 将结果转换为字典列表
            columns = result.keys()
            rows = [dict(zip(columns, row)) for row in result]
            
            # 获取表结构信息（用于显示列名和类型）
            result = conn.execute(text(f"DESCRIBE `{table_name}`"))
            columns_info = [dict(zip(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'], row)) for row in result]
            
            return {
                "table_name": table_name,
                "data": rows,
                "columns": columns_info,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_count": total_count,
                    "total_pages": total_pages
                }
            }
            
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取表数据失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取表数据失败: {str(e)}"
        )

@router.post("/stats")
async def get_database_stats(request: DatabaseStatsRequest, current_user: UserInDB = Depends(get_current_user)):
    """
    获取数据库统计信息，包括表数量和总记录数
    """
    try:
        # 使用默认值，防止空值
        database = request.database or "media_crawler"
        print(f"正在获取数据库 {database} 的统计信息")
        
        try:
            # 尝试连接数据库
            conn = DB_ENGINE.connect()
            print("数据库连接成功")
        except Exception as conn_err:
            print(f"数据库连接失败: {str(conn_err)}")
            traceback.print_exc()
            # 使用模拟数据代替
            return DatabaseStats(
                database=database,
                tableCount=0,
                recordCount=0,
                storageSize="0 MB"
            )
        
        try:
            # 获取所有表
            print("正在执行: SHOW TABLES")
            result = conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result]
            table_count = len(tables)
            print(f"获取到 {table_count} 个表")
            
            # 获取每个表的记录数并汇总
            total_records = 0
            for table in tables:
                try:
                    count_sql = f"SELECT COUNT(*) FROM `{table}`"
                    print(f"正在执行: {count_sql}")
                    result = conn.execute(text(count_sql))
                    count = result.scalar() or 0
                    total_records += count
                    print(f"表 {table} 有 {count} 条记录")
                except Exception as table_err:
                    print(f"获取表 {table} 记录数时失败: {str(table_err)}")
            
            # 获取数据库大小信息
            size_sql = f"SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.tables WHERE table_schema = '{database}'"
            print(f"正在执行: {size_sql}")
            try:
                result = conn.execute(text(size_sql))
                size_mb = result.scalar() or 0
                print(f"数据库大小: {size_mb} MB")
            except Exception as size_err:
                print(f"获取数据库大小失败: {str(size_err)}")
                size_mb = 0
            
            storage_size = f"{size_mb} MB"
            
            # 组装结果
            stats = DatabaseStats(
                database=database,
                tableCount=table_count,
                recordCount=total_records,
                storageSize=storage_size
            )
            print(f"成功生成数据库统计: {stats}")
            return stats
        except Exception as query_err:
            print(f"执行SQL查询失败: {str(query_err)}")
            traceback.print_exc()
            # 返回空结果而不是抛出异常
            return DatabaseStats(
                database=database,
                tableCount=0,
                recordCount=0,
                storageSize="0 MB"
            )
        finally:
            try:
                conn.close()
                print("数据库连接已关闭")
            except Exception as close_err:
                print(f"关闭数据库连接失败: {str(close_err)}")
    except Exception as e:
        print(f"获取数据库统计信息失败: {str(e)}")
        traceback.print_exc()
        # 返回空结果而不是抛出异常，这样前端会显示0而不是错误
        return DatabaseStats(
            database=database or "media_crawler",
            tableCount=0,
            recordCount=0,
            storageSize="0 MB"
        )

@router.delete("/tables/{table_name}/records/{record_id}")
async def delete_record(
    table_name: str,
    record_id: str,
    id_column: str = Query(..., description="主键列名"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    删除表中的指定记录
    """
    try:
        # 验证表名和列名是否合法，防止SQL注入
        if not re.match(r'^[a-zA-Z0-9_]+$', table_name) or not re.match(r'^[a-zA-Z0-9_]+$', id_column):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的表名或列名"
            )
        
        conn = DB_ENGINE.connect()
        # 设置自动提交为 False，手动管理事务
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        
        try:
            # 首先检查表是否存在
            result = conn.execute(text(f"SHOW TABLES LIKE '{table_name}'"))
            if not result.first():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"表 {table_name} 不存在"
                )
            
            # 先查询记录是否存在，不使用事务
            result = conn.execute(
                text(f"SELECT * FROM `{table_name}` WHERE `{id_column}` = :record_id LIMIT 1"),
                {"record_id": record_id}
            )
            record = result.first()
            
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"记录不存在: {record_id}"
                )
            
            # 直接执行删除操作，无需事务
            result = conn.execute(
                text(f"DELETE FROM `{table_name}` WHERE `{id_column}` = :record_id"),
                {"record_id": record_id}
            )
            
            return {
                "success": True,
                "message": f"成功删除记录 {record_id}"
            }
            
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        print(f"删除记录失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除记录失败: {str(e)}"
        )

@router.post("/execute")
def execute_sql(
    sql_query: SQLQuery,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    直接执行SQL查询
    """
    # 这里应该连接到实际数据库执行SQL
    # 为了演示，我们返回模拟数据
    mock_results = []
    
    query = sql_query.query.lower()
    
    if "select" in query and "from videos" in query:
        for i in range(1, 6):
            mock_results.append({
                "video_id": f"vid_{i}",
                "title": f"视频 #{i}",
                "view_count": i * 100000,
                "like_count": i * 5000,
                "comment_count": i * 1000
            })
    elif "select" in query and "from comments" in query:
        for i in range(1, 6):
            mock_results.append({
                "comment_id": f"cmt_{i}",
                "video_id": f"vid_{i % 3 + 1}",
                "user_id": f"user_{i % 10 + 1}",
                "content": f"这是第{i}条评论",
                "like_count": i * 10
            })
    else:
        # 默认返回一些数据
        mock_results.append({
            "result": "执行成功",
            "affected_rows": 5
        })
    
    return {
        "sql_query": sql_query.query,
        "results": mock_results
    }

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    上传数据文件并保存到upload目录
    """
    try:
        # 确保上传目录存在
        upload_dir = "upload"
        os.makedirs(upload_dir, exist_ok=True)
        
        # 生成文件名（使用时间戟防止重名）
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = file.filename
        filename_parts = original_filename.split('.')
        
        if len(filename_parts) > 1:
            extension = filename_parts[-1].lower()
            base_name = '.'.join(filename_parts[:-1])
            new_filename = f"{base_name}_{timestamp}.{extension}"
        else:
            new_filename = f"{original_filename}_{timestamp}"
        
        # 检查文件类型是否支持
        supported_extensions = ['csv', 'json', 'xlsx', 'xls']
        file_extension = new_filename.split('.')[-1].lower() if '.' in new_filename else ''
        
        if file_extension not in supported_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件格式: {file_extension}。支持的格式: {', '.join(supported_extensions)}"
            )
        
        # 保存文件
        file_path = os.path.join(upload_dir, new_filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 返回上传成功信息
        return {
            "filename": new_filename,
            "originalName": file.filename,
            "path": file_path,
            "size": os.path.getsize(file_path),
            "fileType": file_extension,
            "createdAt": datetime.datetime.now().isoformat(),
            "message": "文件上传成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传文件失败: {str(e)}"
        )

@router.get("/files")
async def get_uploaded_files(
    current_user: UserInDB = Depends(get_current_user)
):
    """
    获取上传目录中的所有文件的信息
    """
    try:
        # 确保上传目录存在
        upload_dir = "upload"
        os.makedirs(upload_dir, exist_ok=True)
        
        files = []
        
        # 遍历目录中的所有文件
        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            
            # 只处理文件（排除目录）
            if os.path.isfile(file_path):
                # 获取文件信息
                file_stats = os.stat(file_path)
                
                # 推断文件类型
                file_type = filename.split('.')[-1].lower() if '.' in filename else "unknown"
                
                # 格式化文件大小
                size_bytes = file_stats.st_size
                size_str = f"{size_bytes} B"
                if size_bytes > 1024:
                    size_str = f"{size_bytes/1024:.1f} KB"
                if size_bytes > 1024 * 1024:
                    size_str = f"{size_bytes/(1024*1024):.1f} MB"
                
                # 添加到结果列表
                files.append({
                    "filename": filename,
                    "originalName": filename,
                    "path": file_path,
                    "size": size_bytes,
                    "size_formatted": size_str,
                    "fileType": file_type,
                    "createdAt": datetime.datetime.fromtimestamp(file_stats.st_ctime).isoformat()
                })
        
        # 按最后修改时间倒序排序
        files.sort(key=lambda x: x["createdAt"], reverse=True)
        
        return {"files": files}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件列表失败: {str(e)}"
        )

@router.delete("/files/{filename}")
async def delete_file(
    filename: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    删除上传目录中的指定文件
    """
    try:
        # 验证文件名，防止路径穿越攻击
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的文件名"
            )
        
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 检查文件是否存在
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文件不存在"
            )
        
        # 删除文件
        os.remove(file_path)
        
        return {
            "filename": filename,
            "message": "文件已成功删除"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除文件失败: {str(e)}"
        )

@router.get("/files/{filename}/analyze")
async def analyze_file(
    filename: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    分析上传的文件，返回列信息和推荐的主键
    """
    try:
        # 验证文件名，防止路径穿越攻击
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的文件名"
            )
        
        upload_dir = "upload"
        file_path = os.path.join(upload_dir, filename)
        
        # 检查文件是否存在
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文件不存在"
            )
        
        # 根据文件类型读取数据
        file_extension = filename.split('.')[-1].lower()
        
        if file_extension == 'csv':
            df = pd.read_csv(file_path)
        elif file_extension == 'json':
            df = pd.read_json(file_path)
        elif file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不支持的文件格式"
            )
        
        # 分析列信息和推断主键
        columns_info = []
        likely_primary_keys = []
        
        # 常见主键命名模式
        primary_key_patterns = [
            r'^id$', r'^_id$', r'^uuid$', r'^编号$', r'^主键$', r'^key$',
            r'^[a-z]+_id$', r'^[a-z]+_key$', r'^unique_id$', r'^primary$'
        ]
        
        for col in df.columns:
            col_data = df[col].dropna().values
            data_type = str(df[col].dtype)
            
            # 获取样本值
            sample_values = df[col].head(5).tolist()
            
            # 检查列名是否符合主键模式
            is_likely_pk = False
            pk_score = 0
            
            if any(re.match(pattern, str(col).lower()) for pattern in primary_key_patterns):
                is_likely_pk = True
                pk_score = 3
            
            # 如果是数值类型，检查是否唯一且连续
            elif ('int' in data_type or 'float' in data_type) and len(col_data) > 0:
                unique_count = len(set(col_data))
                if unique_count == len(col_data):
                    is_likely_pk = True
                    pk_score = 2
            
            # 如果是字符串类型，检查是否唯一
            elif 'object' in data_type and len(col_data) > 0:
                unique_count = len(set(str(x) for x in col_data if x is not None))
                if unique_count == len(col_data) and all(str(x).strip() != '' for x in col_data if x is not None):
                    is_likely_pk = True
                    pk_score = 1
            
            if is_likely_pk:
                likely_primary_keys.append((col, pk_score))
            
            # 添加列信息
            columns_info.append(
                ColumnInfo(
                    name=str(col),
                    type=data_type,
                    sample_values=sample_values,
                    is_likely_primary_key=is_likely_pk
                )
            )
        
        # 选择最可能的主键
        suggested_primary_key = None
        if likely_primary_keys:
            likely_primary_keys.sort(key=lambda x: x[1], reverse=True)
            suggested_primary_key = likely_primary_keys[0][0]
        
        # 准备预览数据 (前10行)
        preview_rows = df.head(10).to_dict('records')
        
        return FileAnalysisResponse(
            columns=columns_info,
            suggested_primary_key=suggested_primary_key,
            total_rows=len(df),
            preview_rows=preview_rows
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析文件失败: {str(e)}"
        )

@router.post("/files/{filename}/import")
async def import_to_database(
    filename: str,
    primary_key: Optional[str] = Form(None),
    current_user: UserInDB = Depends(get_current_user)
):
    """将文件导入到MySQL数据库的指定表中"""
    try:
        print(f"开始处理文件导入请求: {filename}, 主键: {primary_key}")
        # primary_key参数直接从函数参数中获取
        
        # 生成目标表名
        original_name = filename.split('.')[0]  # 去除文件扩展名
        table_name = original_name.split('_')[0] if '_' in original_name else original_name  # 仅使用文件名前缀
        
        # 验证表名格式
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', table_name):
            table_name = f"table_{int(time.time())}"
            print(f"原始表名不符合命名规则，改为: {table_name}")
        
        print(f"目标表名: {table_name}")
        
        # 检查文件是否存在
        upload_dir = "upload"
        filepath = os.path.join(upload_dir, filename)
        if not os.path.exists(filepath):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"文件不存在: {filepath}"
            )
        
        # 根据文件类型加载数据
        print(f"读取文件: {filepath}")
        if filename.endswith('.csv'):
            df = pd.read_csv(filepath)
        elif filename.endswith('.json'):
            df = pd.read_json(filepath)
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(filepath)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型: {filename}"
            )
        
        print(f"成功加载数据，行数: {len(df)}, 列数: {len(df.columns)}")
        
        # 如果没有提供主键，使用默认的主键推测算法
        if not primary_key:
            print("没有指定主键，尝试推断主键")
            primary_key_patterns = [
                r'^id$', r'^_id$', r'^uuid$', r'^\u7f16\u53f7$', r'^\u4e3b\u952e$', r'^key$',
                r'^[a-z]+_id$', r'^[a-z]+_key$', r'^unique_id$', r'^primary$', r'^video_id$'
            ]
            
            likely_primary_keys = []
            for col in df.columns:
                # 检查列名是否符合主键模式
                if any(re.match(pattern, str(col).lower()) for pattern in primary_key_patterns):
                    likely_primary_keys.append((col, 3))
                    continue
                
                try:
                    col_data = df[col].dropna().values
                    data_type = str(df[col].dtype)
                    
                    # 数值列的检查
                    if ('int' in data_type or 'float' in data_type) and len(col_data) > 0:
                        unique_count = len(set(col_data))
                        if unique_count == len(col_data):
                            likely_primary_keys.append((col, 2))
                            
                    # 字符串列的检查
                    elif 'object' in data_type and len(col_data) > 0:
                        unique_count = len(set(str(x) for x in col_data if x is not None))
                        if unique_count == len(col_data) and all(str(x).strip() != '' for x in col_data if x is not None):
                            likely_primary_keys.append((col, 1))
                except Exception as e:
                    print(f"检查列 {col} 时出错: {str(e)}")
            
            if likely_primary_keys:
                likely_primary_keys.sort(key=lambda x: x[1], reverse=True)
                primary_key = likely_primary_keys[0][0]
                print(f"推断的主键列: {primary_key}")
        
        # 类型映射 - 将pandas类型映射到SQLAlchemy类型
        type_mapping = {
            'int64': sqlalchemy.Integer,
            'float64': sqlalchemy.Float,
            'bool': sqlalchemy.Boolean,
            'datetime64[ns]': sqlalchemy.DateTime,
            'object': sqlalchemy.String(255),
        }
        
        # 创建数据库连接
        try:
            print("连接到MySQL数据库...")
            conn = DB_ENGINE.connect()
            print("数据库连接成功")
        except Exception as e:
            error_msg = f"无法连接到MySQL数据库: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
        
        try:
            # 检查表是否存在，如果存在则删除
            print(f"删除现有表(如果存在): {table_name}")
            conn.execute(text(f"DROP TABLE IF EXISTS `{table_name}`"))
            
            # 使用pandas的to_sql方法创建表并导入数据
            print(f"准备将数据导入到表: {table_name}, 数据行数: {len(df)}")
            
            # 如果没有主键，直接创建表
            df.to_sql(table_name, con=conn, if_exists='replace', index=False)
            print(f"表创建成功: {table_name}")
            
            # 如果有主键，尝试添加主键约束
            if primary_key and primary_key in df.columns:
                try:
                    print(f"尝试添加主键约束到列: {primary_key}")
                    conn.execute(text(f"ALTER TABLE `{table_name}` ADD PRIMARY KEY (`{primary_key}`);"))
                    print(f"主键约束添加成功: {primary_key}")
                except Exception as e:
                    print(f"添加主键约束失败: {str(e)}, 继续导入数据...")
            
            print(f"数据导入完成，表: {table_name}")
            
            # 返回导入结果
            database_name = "media_crawler"
            return {
                "success": True,
                "filename": filename,
                "table_name": table_name,
                "database": database_name,
                "primary_key": primary_key,
                "row_count": len(df),
                "message": f"数据已成功导入到 {database_name}.{table_name} 表中"
            }
                
        except Exception as e:
            error_detail = f"创建表或写入数据到MySQL失败: {str(e)}"
            print(error_detail)
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_detail
            )
        finally:
            # 关闭连接
            conn.close()
    
    except HTTPException as he:
        # 直接往上抛出HTTPException
        raise
    except Exception as e:
        # 捕获并记录详细错误信息
        error_trace = traceback.format_exc()
        print(f"导入数据到MySQL错误: {str(e)}\n{error_trace}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入数据库失败: {str(e)}"
        )