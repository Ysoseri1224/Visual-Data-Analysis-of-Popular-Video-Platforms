from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from app.core.security import get_password_hash, verify_password
from app.db.mongodb import db
from app.models.user import UserCreate, UserInDB, UserUpdate

async def get_user_by_email(email: str) -> Optional[UserInDB]:
    """
    通过邮箱获取用户
    """
    user = await db.db.users.find_one({"email": email})
    if user:
        return UserInDB(**user)
    return None

async def get_user_by_id(user_id: str) -> Optional[UserInDB]:
    """
    通过ID获取用户
    """
    if not ObjectId.is_valid(user_id):
        return None
    user = await db.db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        return UserInDB(**user)
    return None

async def create_user(user_in: UserCreate) -> UserInDB:
    """
    创建新用户
    """
    try:
        print(f"尝试创建用户: {user_in.email}")
        
        # 检查邮箱是否已存在
        existing_user = await get_user_by_email(user_in.email)
        if existing_user:
            print(f"邮箱已被注册: {user_in.email}")
            raise ValueError("该邮箱已被注册")
        
        # 创建新用户
        user_dict = user_in.dict()
        hashed_password = get_password_hash(user_dict.pop("password"))
        
        user_db = UserInDB(
            **user_dict,
            hashed_password=hashed_password,
            created_at=datetime.utcnow()
        )
        
        user_dict = user_db.dict(by_alias=True)
        print(f"准备插入用户到数据库: {user_dict}")
        
        await db.db.users.insert_one(user_dict)
        print(f"用户创建成功: {user_in.email}")
        
        return user_db
    except Exception as e:
        print(f"创建用户时出错: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise

async def update_user(user_id: str, user_in: UserUpdate) -> Optional[UserInDB]:
    """
    更新用户信息
    """
    user = await get_user_by_id(user_id)
    if not user:
        return None
    
    update_data = user_in.dict(exclude_unset=True)
    
    # 如果更新包含密码，则哈希处理
    if "password" in update_data:
        hashed_password = get_password_hash(update_data.pop("password"))
        update_data["hashed_password"] = hashed_password
    
    # 更新用户
    await db.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    return await get_user_by_id(user_id)

async def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
    """
    验证用户凭据
    """
    try:
        print(f"尝试验证用户: {email}")
        
        user = await get_user_by_email(email)
        if not user:
            print(f"用户不存在: {email}")
            return None
            
        # 检查用户状态是否为已禁用
        if user.status == "banned":
            print(f"用户已被禁用: {email}")
            # 返回None但不更新登录时间
            return None
            
        print(f"找到用户: {email}, 正在验证密码")
        if not verify_password(password, user.hashed_password):
            print(f"密码验证失败: {email}")
            return None
            
        print(f"密码验证成功: {email}")
        
        # 更新最后登录时间
        await db.db.users.update_one(
            {"_id": user.id},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        print(f"用户登录成功: {email}")
        return user
    except Exception as e:
        print(f"验证用户时出错: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None

async def authenticate_admin(email: str, password: str) -> Optional[UserInDB]:
    """
    验证管理员凭据
    """
    try:
        print(f"尝试验证管理员: {email}")
        
        # 获取用户并检查是否为管理员
        user = await get_user_by_email(email)
        if not user:
            print(f"用户不存在: {email}")
            return None
            
        if user.role != "admin":
            print(f"用户不是管理员: {email}")
            return None
            
        # 检查管理员状态是否为已禁用
        if user.status == "banned":
            print(f"管理员已被禁用: {email}")
            # 返回None但不更新登录时间
            return None
            
        print(f"找到管理员: {email}, 正在验证密码")
        if not verify_password(password, user.hashed_password):
            print(f"密码验证失败: {email}")
            return None
            
        print(f"密码验证成功: {email}")
        
        # 更新最后登录时间
        await db.db.users.update_one(
            {"_id": user.id},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        print(f"管理员登录成功: {email}")
        return user
    except Exception as e:
        print(f"验证管理员时出错: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None

async def get_all_users() -> List[UserInDB]:
    """
    获取所有用户信息
    """
    try:
        print("正在获取所有用户信息")
        users_cursor = db.db.users.find({})
        users = []
        async for user in users_cursor:
            users.append(UserInDB(**user))
        print(f"成功获取{len(users)}个用户信息")
        return users
    except Exception as e:
        print(f"获取所有用户时出错: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return []
        
async def update_user_status(user_id: str, status: str) -> Optional[UserInDB]:
    """
    更新用户状态 (active, inactive, banned)
    """
    if not ObjectId.is_valid(user_id):
        return None
        
    try:
        # 更新用户状态
        await db.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"status": status}}
        )
        
        return await get_user_by_id(user_id)
    except Exception as e:
        print(f"更新用户状态时出错: {str(e)}")
        return None
        
async def delete_user(user_id: str) -> bool:
    """
    删除用户
    """
    if not ObjectId.is_valid(user_id):
        return False
        
    try:
        result = await db.db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            return False
        
        return True
    except Exception as e:
        print(f"删除用户时出错: {str(e)}")
        return False

async def update_user_info(user_id: str, username: str = None, email: str = None, role: str = None, status: str = None) -> Optional[UserInDB]:
    """
    更新用户完整信息
    """
    try:
        # 输出调试信息
        print(f"开始更新用户信息: user_id={user_id}, username={username}, email={email}, role={role}, status={status}")
        
        if not ObjectId.is_valid(user_id):
            print(f"无效的用户ID: {user_id}")
            return None
        
        # 检查用户是否存在
        user = await get_user_by_id(user_id)
        if not user:
            print(f"用户不存在: {user_id}")
            return None
        
        # 准备更新数据
        update_data = {}
        
        if username is not None:
            # 防止空字符串或None值
            if isinstance(username, str) and username.strip():
                update_data["username"] = username.strip()
                print(f"将更新用户名为: {username}")
        
        if email is not None:
            # 防止空字符串或None值
            if isinstance(email, str) and email.strip():
                # 检查新邮箱是否与其他用户冲突
                if email != user.email:
                    existing_user = await get_user_by_email(email)
                    if existing_user and str(existing_user.id) != user_id:
                        print(f"邮箱冲突: {email} 已被用户 {existing_user.username} 使用")
                        raise ValueError("该邮箱已被其他用户注册")
                update_data["email"] = email.strip()
                print(f"将更新邮箱为: {email}")
        
        if role is not None:
            if isinstance(role, str) and role in ["admin", "user"]:
                update_data["role"] = role
                print(f"将更新角色为: {role}")
            else:
                print(f"角色值无效: {role}")
        
        if status is not None:
            if isinstance(status, str) and status in ["active", "inactive", "banned"]:
                update_data["status"] = status
                print(f"将更新状态为: {status}")
            else:
                print(f"状态值无效: {status}")
        # 如果没有更新内容，直接返回用户
        if not update_data:
            print("没有有效的更新数据，跳过更新操作")
            return user
        
        # 更新用户信息
        update_data["updated_at"] = datetime.utcnow()
        print(f"最终更新数据: {update_data}")
        
        try:
            result = await db.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            
            print(f"数据库更新结果: modified_count={result.modified_count}, matched_count={result.matched_count}")
            
            if result.matched_count == 0:
                print(f"未找到匹配的用户: {user_id}")
                return None
                
            # 返回更新后的用户信息
            updated_user = await get_user_by_id(user_id)
            print(f"更新成功，返回用户信息: id={user_id}")
            return updated_user
            
        except Exception as db_error:
            print(f"数据库更新操作失败: {str(db_error)}")
            raise ValueError(f"数据库更新失败: {str(db_error)}")
            
    except Exception as e:
        print(f"处理用户数据时出错: {str(e)}")
        raise
