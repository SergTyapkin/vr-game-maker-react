# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import engine, Base
from api import scripts, textures, models, materials, scenes
from websocket import websocket_endpoint

# Создаем директории для хранения файлов
os.makedirs("storage/textures", exist_ok=True)
os.makedirs("storage/models", exist_ok=True)
os.makedirs("storage/scripts", exist_ok=True)
os.makedirs("storage/thumbnails", exist_ok=True)
os.makedirs("data", exist_ok=True)

# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VR Game Studio API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы
app.mount("/assets/textures", StaticFiles(directory="storage/textures"), name="textures")
app.mount("/assets/models", StaticFiles(directory="storage/models"), name="models")
app.mount("/assets/thumbnails", StaticFiles(directory="storage/thumbnails"), name="thumbnails")

# API роуты
app.include_router(scripts.router, prefix="/api/scripts", tags=["scripts"])
app.include_router(textures.router, prefix="/api/textures", tags=["textures"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(materials.router, prefix="/api/materials", tags=["materials"])
app.include_router(scenes.router, prefix="/api/scenes", tags=["scenes"])

# WebSocket
app.add_api_websocket_route("/api/ws/scenes", websocket_endpoint)

@app.get("/")
async def root():
    return {"message": "VR Game Studio API", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

