# backend/api/textures.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import os
import base64
import uuid
from datetime import datetime
import aiofiles

from schemas import TextureData, TexturesListResponse, TextureResponse

router = APIRouter()
TEXTURES_DIR = "storage/textures"

@router.get("", response_model=TexturesListResponse)
async def get_textures():
    textures = []

    if os.path.exists(TEXTURES_DIR):
        for filename in os.listdir(TEXTURES_DIR):
            filepath = os.path.join(TEXTURES_DIR, filename)
            if os.path.isfile(filepath):
                ext = filename.split('.')[-1].lower()
                if ext in ['png', 'jpg', 'jpeg', 'webp', 'bmp']:
                    stat = os.stat(filepath)

                    # Получаем размеры изображения
                    width, height = None, None
                    try:
                        with Image.open(filepath) as img:
                            width, height = img.size
                    except:
                        pass

                    textures.append(TextureData(
                        id=base64.b64encode(filename.encode()).decode(),
                        name=filename,
                        url=f"/assets/textures/{filename}",
                        size=stat.st_size,
                        format=ext,
                        width=width,
                        height=height,
                        uploaded_at=datetime.fromtimestamp(stat.st_mtime)
                    ))

    return {"textures": textures}

@router.post("", response_model=TextureResponse)
async def upload_texture(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.split('.')[-1].lower()
    if ext not in ['png', 'jpg', 'jpeg', 'webp', 'bmp']:
        raise HTTPException(status_code=400, detail="Invalid file format")

    # Генерируем уникальное имя
    unique_id = str(uuid.uuid4())[:8]
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in '.-_')
    filename = f"{unique_id}_{safe_name}"
    filepath = os.path.join(TEXTURES_DIR, filename)

    # Сохраняем файл
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)

    stat = os.stat(filepath)

    # Получаем размеры
    width, height = None, None
    try:
        with Image.open(filepath) as img:
            width, height = img.size
    except:
        pass

    texture = TextureData(
        id=base64.b64encode(filename.encode()).decode(),
        name=filename,
        url=f"/assets/textures/{filename}",
        size=stat.st_size,
        format=ext,
        width=width,
        height=height,
        uploaded_at=datetime.now()
    )

    return {"texture": texture}

@router.delete("/{texture_id}")
async def delete_texture(texture_id: str):
    try:
        filename = base64.b64decode(texture_id).decode()
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    filepath = os.path.join(TEXTURES_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Texture not found")

    os.remove(filepath)
    return {"success": True}
