# backend/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Текстуры
class TextureData(BaseModel):
    id: str
    name: str
    url: str
    size: int
    format: str
    width: Optional[int] = None
    height: Optional[int] = None
    uploaded_at: datetime

class TexturesListResponse(BaseModel):
    textures: List[TextureData]

class TextureResponse(BaseModel):
    texture: TextureData

# Материалы
class MaterialProperties(BaseModel):
    color: Optional[str] = "#ffffff"
    emissive: Optional[str] = "#000000"
    roughness: Optional[float] = 0.5
    metalness: Optional[float] = 0.0
    transparent: Optional[bool] = False
    opacity: Optional[float] = 1.0
    wireframe: Optional[bool] = False
    map: Optional[str] = ""
    normalMap: Optional[str] = ""
    roughnessMap: Optional[str] = ""
    metalnessMap: Optional[str] = ""

class MaterialData(BaseModel):
    id: str
    name: str
    type: str
    properties: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class MaterialCreate(BaseModel):
    name: str
    type: str = "standard"
    properties: Optional[Dict[str, Any]] = {}

class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

class MaterialsListResponse(BaseModel):
    materials: List[MaterialData]

class MaterialResponse(BaseModel):
    material: MaterialData

class Model3DData(BaseModel):
    id: str
    name: str
    url: str
    size: int
    format: str
    thumbnail: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
    uploaded_at: datetime

class ModelsListResponse(BaseModel):
    models: List[Model3DData]

class ModelResponse(BaseModel):
    model: Model3DData

# Сцены
class SceneSettings(BaseModel):
    ambientLight: Optional[Dict[str, Any]] = None
    fog: Optional[Dict[str, Any]] = None
    skybox: Optional[Dict[str, Any]] = None

class SceneMetadata(BaseModel):
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    version: int
    thumbnail: Optional[str] = None

    class Config:
        populate_by_name = True  # Позволяет использовать оба имени


class SceneData(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    objects: Dict[str, Any] = {}
    rootObjects: List[str] = []
    settings: Optional[SceneSettings] = None
    metadata: SceneMetadata

class SceneCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class SceneUpdate(BaseModel):
    scene: SceneData

class ScenesListResponse(BaseModel):
    scenes: List[SceneData]

class SceneResponse(BaseModel):
    scene: SceneData

# Скрипты
class ScriptFile(BaseModel):
     path: str
     name: str
     content: str
     size: int
     modified_at: str

class ScriptDirectory(BaseModel):
   path: str
   name: str
   children: List[Any]  # ScriptFile | ScriptDirectory

class ScriptsTreeResponse(BaseModel):
   tree: List[Any]

class ScriptContentResponse(BaseModel):
   file: ScriptFile

class ScriptSaveRequest(BaseModel):
   path: str
   content: Optional[str] = None  # Сделали опциональным
   action: str = "save"
