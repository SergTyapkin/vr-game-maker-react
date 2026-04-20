# backend/api/scripts.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import os
import base64
from datetime import datetime
from typing import List, Union
import aiofiles
from urllib.parse import unquote
import os
import base64
from datetime import datetime
import aiofiles

from schemas import ScriptFile, ScriptDirectory, ScriptsTreeResponse, ScriptContentResponse, ScriptSaveRequest

router = APIRouter()
SCRIPTS_DIR = "storage/scripts"

# Создаем примеры скриптов при первом запуске
def create_example_scripts():
    examples = {
        "behaviors/DoorController.js": '''export default {
  name: 'DoorController',

  schema: {
    openSpeed: { type: 'number', default: 2.0 },
    openAngle: { type: 'number', default: 90 },
    autoClose: { type: 'boolean', default: false }
  },

  setup({ state, events, THREE }) {
    state.isOpen = false;

    events.on('select', (e) => {
      if (e.target === state.object) {
        state.isOpen = !state.isOpen;
      }
    });

    return {
      update(deltaTime) {
        if (!state.isOpen) return;

        const targetRot = state.openAngle * (Math.PI / 180);
        state.object.rotation.y = THREE.MathUtils.lerp(
          state.object.rotation.y,
          targetRot,
          deltaTime * state.openSpeed
        );
      }
    };
  }
};''',
        "behaviors/MovableObject.js": '''export default {
  name: 'MovableObject',

  schema: {
    speed: { type: 'number', default: 1.0 },
    resetPosition: { type: 'boolean', default: false }
  },

  setup({ state, events, THREE }) {
    state.isGrabbed = false;
    state.initialPosition = state.object.position.clone();

    events.on('grab', (e) => {
      if (e.target === state.object) {
        state.isGrabbed = true;
      }
    });

    events.on('release', (e) => {
      if (e.target === state.object) {
        state.isGrabbed = false;
        if (state.resetPosition) {
          state.object.position.copy(state.initialPosition);
        }
      }
    });

    return {
      update(deltaTime, controller) {
        if (state.isGrabbed && controller) {
          state.object.position.lerp(controller.position, deltaTime * state.speed);
        }
      }
    };
  }
};''',
        "utils/helpers.js": '''export function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}''',
    }

    for path, content in examples.items():
        full_path = os.path.join(SCRIPTS_DIR, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

# Создаем примеры при импорте
os.makedirs(SCRIPTS_DIR, exist_ok=True)
create_example_scripts()

def read_scripts_directory(dir_path: str, relative_path: str = "") -> List[Union[ScriptFile, ScriptDirectory]]:
    items = []
    full_path = os.path.join(SCRIPTS_DIR, relative_path)

    if not os.path.exists(full_path):
        return items

    try:
        entries = sorted(os.listdir(full_path))
    except OSError:
        return items

    for entry in entries:
        # Пропускаем скрытые файлы
        if entry.startswith('.'):
            continue

        item_path = os.path.join(relative_path, entry)
        full_item_path = os.path.join(SCRIPTS_DIR, item_path)

        if os.path.isdir(full_item_path):
            children = read_scripts_directory(full_item_path, item_path)
            items.append(ScriptDirectory(
                path="/" + item_path.replace("\\", "/"),
                name=entry,
                children=children
            ))
        elif os.path.isfile(full_item_path):
            # Проверяем расширение
            # if entry.endswith(('.js', '.ts', '.json', '.txt')):
            stat = os.stat(full_item_path)
            items.append(ScriptFile(
                path="/" + item_path.replace("\\", "/"),
                name=entry,
                content="",  # Содержимое загружается отдельным запросом
                size=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat()
            ))

    # Сортировка: папки первыми, потом файлы по алфавиту
    items.sort(key=lambda x: (not isinstance(x, ScriptDirectory), x.name.lower()))
    return items

@router.get("", response_model=ScriptsTreeResponse)
async def get_scripts(path: str = Query(None)):
    if path:
        full_path = os.path.join(SCRIPTS_DIR, path.lstrip('/'))
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")

        stat = os.stat(full_path)
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return JSONResponse({
            "file": {
                "path": path,
                "name": os.path.basename(path),
                "content": content,
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            }
        })

    tree = read_scripts_directory(SCRIPTS_DIR)
    return {"tree": tree}

@router.post("")
async def save_script(request: ScriptSaveRequest):
    # Декодируем URL-кодированный путь (для поддержки кириллицы)
    path = unquote(request.path.lstrip('/'))
    full_path = os.path.join(SCRIPTS_DIR, path)

    if request.action == "delete":
        if os.path.exists(full_path):
            if os.path.isfile(full_path):
                os.remove(full_path)
            else:
                # Если это папка, удаляем рекурсивно
                import shutil
                shutil.rmtree(full_path)
        return {"success": True}

    # Для save/create
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    content = request.content or ""

    # Используем utf-8 для поддержки кириллицы
    async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
        await f.write(content)

    stat = os.stat(full_path)

    return {
        "file": {
            "path": "/" + path,
            "name": os.path.basename(path),
            "content": content,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    }
