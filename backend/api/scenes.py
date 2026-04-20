# backend/api/scenes.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from database import get_db, SceneModel
from schemas import SceneData, SceneCreate, SceneUpdate, ScenesListResponse, SceneResponse, SceneMetadata, SceneSettings

router = APIRouter()

@router.get("", response_model=ScenesListResponse)
async def get_scenes(db: Session = Depends(get_db)):
    scenes = db.query(SceneModel).order_by(SceneModel.updated_at.desc()).all()

    return {
        "scenes": [
            SceneData(
                id=s.id,
                name=s.name,
                description=s.description,
                objects=s.data.get("objects", {}),
                rootObjects=s.data.get("rootObjects", []),
                settings=s.data.get("settings"),
                metadata=SceneMetadata(
                    created_at=s.created_at,
                    updated_at=s.updated_at,
                    version=s.version,
                    thumbnail=s.thumbnail
                )
            )
            for s in scenes
        ]
    }

@router.post("", response_model=SceneResponse)
async def create_scene(data: SceneCreate, db: Session = Depends(get_db)):
    scene_id = str(uuid.uuid4())

    scene_data = {
        "objects": {},
        "rootObjects": [],
        "settings": {
            "ambientLight": {
                "color": "#404040",
                "intensity": 0.5
            }
        }
    }

    scene = SceneModel(
        id=scene_id,
        name=data.name,
        description=data.description or "",
        data=scene_data,
        version=1
    )

    db.add(scene)
    db.commit()
    db.refresh(scene)

    return {
        "scene": SceneData(
            id=scene.id,
            name=scene.name,
            description=scene.description,
            objects=scene.data.get("objects", {}),
            rootObjects=scene.data.get("rootObjects", []),
            settings=scene.data.get("settings"),
            metadata=SceneMetadata(
                created_at=scene.created_at,
                updated_at=scene.updated_at,
                version=scene.version,
                thumbnail=scene.thumbnail
            )
        )
    }

@router.get("/{scene_id}", response_model=SceneResponse)
async def get_scene(scene_id: str, db: Session = Depends(get_db)):
    scene = db.query(SceneModel).filter(SceneModel.id == scene_id).first()

    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    return {
        "scene": SceneData(
            id=scene.id,
            name=scene.name,
            description=scene.description,
            objects=scene.data.get("objects", {}),
            rootObjects=scene.data.get("rootObjects", []),
            settings=scene.data.get("settings"),
            metadata=SceneMetadata(
                created_at=scene.created_at,
                updated_at=scene.updated_at,
                version=scene.version,
                thumbnail=scene.thumbnail
            )
        )
    }

@router.put("/{scene_id}", response_model=SceneResponse)
async def update_scene(scene_id: str, data: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(SceneModel).filter(SceneModel.id == scene_id).first()

    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # Конвертируем SceneData в словарь для сохранения в JSON
    scene_data_dict = {
        "objects": data.scene.objects,
        "rootObjects": data.scene.rootObjects,
        "settings": data.scene.settings.model_dump() if data.scene.settings else None
    }

    scene.data = scene_data_dict
    scene.name = data.scene.name
    scene.description = data.scene.description
    scene.version = data.scene.metadata.version + 1  # Увеличиваем версию
    scene.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(scene)

    # Формируем ответ
    return {
        "scene": SceneData(
            id=scene.id,
            name=scene.name,
            description=scene.description,
            objects=scene.data.get("objects", {}),
            rootObjects=scene.data.get("rootObjects", []),
            settings=scene.data.get("settings"),
            metadata=SceneMetadata(
                created_at=scene.created_at,
                updated_at=scene.updated_at,
                version=scene.version,
                thumbnail=scene.thumbnail
            )
        )
    }

@router.delete("/{scene_id}")
async def delete_scene(scene_id: str, db: Session = Depends(get_db)):
    scene = db.query(SceneModel).filter(SceneModel.id == scene_id).first()

    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    db.delete(scene)
    db.commit()

    return {"success": True}
