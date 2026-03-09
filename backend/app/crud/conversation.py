from datetime import datetime
from typing import List, Optional
from bson import ObjectId

from app.db.mongodb import db
from app.schemas.message import MessageCreate, ConversationCreate, ConversationUpdate

async def create_conversation(conversation_in: ConversationCreate) -> str:
    """
    u521bu5efau65b0u5bf9u8bdd
    """
    conversation_data = conversation_in.dict()
    conversation_data["created_at"] = datetime.utcnow()
    conversation_data["updated_at"] = datetime.utcnow()
    conversation_data["messages"] = []
    
    result = await db.db.conversations.insert_one(conversation_data)
    return str(result.inserted_id)

async def get_conversation(conversation_id: str) -> Optional[dict]:
    """
    u83b7u53d6u5bf9u8bddu8be6u60c5
    """
    if not ObjectId.is_valid(conversation_id):
        return None
    
    conversation = await db.db.conversations.find_one({"_id": ObjectId(conversation_id)})
    return conversation

async def get_user_conversations(user_id: str) -> List[dict]:
    """
    u83b7u53d6u7528u6237u7684u6240u6709u5bf9u8bdd
    """
    cursor = db.db.conversations.find({"user_id": user_id}).sort("updated_at", -1)
    conversations = await cursor.to_list(length=100)  # u9650u5236u6700u591au8fd4u56de100u4e2au5bf9u8bdd
    return conversations

async def update_conversation(conversation_id: str, conversation_in: ConversationUpdate) -> Optional[dict]:
    """
    u66f4u65b0u5bf9u8bddu4fe1u606f
    """
    if not ObjectId.is_valid(conversation_id):
        return None
    
    update_data = conversation_in.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": update_data}
    )
    
    return await get_conversation(conversation_id)

async def delete_conversation(conversation_id: str) -> bool:
    """
    u5220u9664u5bf9u8bdd
    """
    if not ObjectId.is_valid(conversation_id):
        return False
    
    result = await db.db.conversations.delete_one({"_id": ObjectId(conversation_id)})
    return result.deleted_count > 0

async def add_message_to_conversation(conversation_id: str, message_in: MessageCreate) -> Optional[str]:
    """
    u5411u5bf9u8bddu4e2du6dfbu52a0u65b0u6d88u606f
    """
    if not ObjectId.is_valid(conversation_id):
        return None
    
    # u68c0u67e5u5bf9u8bddu662fu5426u5b58u5728
    conversation = await get_conversation(conversation_id)
    if not conversation:
        return None
    
    # u51c6u5907u6d88u606fu6570u636e
    message_data = message_in.dict()
    message_data["_id"] = ObjectId()  # u751fu6210u65b0u7684u6d88u606f ID
    message_data["created_at"] = datetime.utcnow()
    
    # u6dfbu52a0u6d88u606fu5230u5bf9u8bddu4e2d
    await db.db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$push": {"messages": message_data},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return str(message_data["_id"])

async def get_conversation_messages(conversation_id: str) -> List[dict]:
    """
    u83b7u53d6u5bf9u8bddu4e2du7684u6240u6709u6d88u606f
    """
    if not ObjectId.is_valid(conversation_id):
        return []
    
    conversation = await get_conversation(conversation_id)
    if not conversation:
        return []
    
    return conversation.get("messages", [])
