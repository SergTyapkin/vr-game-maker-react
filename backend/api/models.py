# backend/api/models.py
from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import base64
import uuid
from datetime import datetime
import aiofiles

from schemas import Model3DData, ModelsListResponse, ModelResponse

router = APIRouter()
MODELS_DIR = "storage/models"

@router.get("", response_model=ModelsListResponse)
async def get_models():
    models = []

    if os.path.exists(MODELS_DIR):
        for filename in os.listdir(MODELS_DIR):
            filepath = os.path.join(MODELS_DIR, filename)
            if os.path.isfile(filepath):
                ext = filename.split('.')[-1].lower()
                if ext in ['gltf', 'glb', 'fbx', 'obj']:
                    stat = os.stat(filepath)

                    # Проверяем наличие превью
                    thumbnail_name = filename.rsplit('.', 1)[0] + '_thumb.jpg'
                    thumbnail_path = os.path.join("storage/thumbnails", thumbnail_name)
                    thumbnail = f"/assets/thumbnails/{thumbnail_name}" if os.path.exists(thumbnail_path) else None

                    models.append(Model3DData(
                        id=base64.b64encode(filename.encode()).decode(),
                        name=filename,
                        url=f"/assets/models/{filename}",
                        size=stat.st_size,
                        format=ext,
                        thumbnail=thumbnail,
                        extra_data=None,  # Можно добавить парсинг метаданных
                        uploaded_at=datetime.fromtimestamp(stat.st_mtime)
                    ))

    return {"models": models}


@router.post("", response_model=ModelResponse)
async def upload_model(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.split('.')[-1].lower()
    if ext not in ['gltf', 'glb', 'fbx', 'obj']:
        raise HTTPException(status_code=400, detail="Invalid file format")

    unique_id = str(uuid.uuid4())[:8]
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in '.-_')
    filename = f"{unique_id}_{safe_name}"
    filepath = os.path.join(MODELS_DIR, filename)

    os.makedirs(MODELS_DIR, exist_ok=True)

    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)

    stat = os.stat(filepath)

    model = Model3DData(
        id=base64.b64encode(filename.encode()).decode(),
        name=filename,
        url=f"/assets/models/{filename}",
        size=stat.st_size,
        format=ext,
        uploaded_at=datetime.now()
    )

    return {"model": model}


@router.delete("/{model_id}")
async def delete_model(model_id: str):
    try:
        filename = base64.b64decode(model_id).decode()
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    filepath = os.path.join(MODELS_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Model not found")

    os.remove(filepath)

    # Удаляем превью если есть
    thumbnail_name = filename.rsplit('.', 1)[0] + '_thumb.jpg'
    thumbnail_path = os.path.join("storage/thumbnails", thumbnail_name)
    if os.path.exists(thumbnail_path):
        os.remove(thumbnail_path)

    return {"success": True}
