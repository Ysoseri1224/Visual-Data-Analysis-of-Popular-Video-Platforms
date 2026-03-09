from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import create_engine, text, inspect
import traceback
from typing import Dict, List, Any

from app.api.endpoints.auth import get_current_user
from app.models.user import UserInDB
from app.api.endpoints.data import DB_ENGINE

router = APIRouter()

@router.get("/database-schema")
async def get_database_schema(current_user: UserInDB = Depends(get_current_user)):
    """
    获取数据库schema（所有表名和列名）
    返回格式: {
        "tables": [
            {
                "name": "表名",
                "columns": [
                    {"name": "列名", "type": "数据类型"}
                ]
            }
        ]
    }
    """
    try:
        inspector = inspect(DB_ENGINE)
        tables = []
        
        # 获取所有表名
        table_names = inspector.get_table_names()
        
        for table_name in table_names:
            # 获取每个表的列信息
            columns = []
            for column in inspector.get_columns(table_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"])
                })
            
            # 获取表的主键
            pk = inspector.get_pk_constraint(table_name)
            primary_keys = pk.get('constrained_columns', []) if pk else []
            
            tables.append({
                "name": table_name,
                "columns": columns,
                "primary_keys": primary_keys
            })
        
        return {"tables": tables}
    
    except Exception as e:
        print(f"获取数据库结构失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据库结构失败: {str(e)}"
        )
