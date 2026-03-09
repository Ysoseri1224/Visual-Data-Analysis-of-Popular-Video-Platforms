from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("无效的ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema: Dict[str, Any], field_schema: Dict[str, Any]) -> None:
        field_schema.update(type="string")

class TestDataBase(BaseModel):
    product_name: str
    category: str
    price: float
    stock: int
    sales: int
    rating: float

class TestDataCreate(TestDataBase):
    pass

class TestDataUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    sales: Optional[int] = None
    rating: Optional[float] = None

class TestDataInDB(TestDataBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class TestDataResponse(TestDataBase):
    id: str
    created_at: datetime
    
    model_config = ConfigDict(
        populate_by_name=True
    )
