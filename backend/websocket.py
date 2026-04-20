# backend/websocket.py
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Any
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        # scene_id -> set of websockets
        self.scene_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> user_info
        self.user_info: Dict[WebSocket, Dict[str, Any]] = {}
        # scene_id -> last_scene_data (для синхронизации новых подключений)
        self.scene_data: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, scene_id: str = None):
        await websocket.accept()

        if scene_id:
            if scene_id not in self.scene_connections:
                self.scene_connections[scene_id] = set()
            self.scene_connections[scene_id].add(websocket)

        self.user_info[websocket] = {"scene_id": scene_id}
        print(f"[WS] Client connected to scene: {scene_id}")

    def disconnect(self, websocket: WebSocket):
        info = self.user_info.get(websocket, {})
        scene_id = info.get("scene_id")

        if scene_id and scene_id in self.scene_connections:
            self.scene_connections[scene_id].discard(websocket)
            if not self.scene_connections[scene_id]:
                del self.scene_connections[scene_id]

        if websocket in self.user_info:
            del self.user_info[websocket]

        print(f"[WS] Client disconnected from scene: {scene_id}")

    async def send_message(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except:
            pass

    async def broadcast_to_scene(self, scene_id: str, message: dict, exclude: WebSocket = None):
        if scene_id in self.scene_connections:
            for connection in self.scene_connections[scene_id]:
                if connection != exclude:
                    await self.send_message(connection, message)

    async def broadcast_user_joined(self, scene_id: str, user: dict, exclude: WebSocket = None):
        await self.broadcast_to_scene(scene_id, {
            "type": "user:joined",
            "user": user
        }, exclude)

    async def broadcast_user_left(self, scene_id: str, user_id: str):
        await self.broadcast_to_scene(scene_id, {
            "type": "user:left",
            "userId": user_id
        })

    def update_scene_data(self, scene_id: str, data: dict):
        self.scene_data[scene_id] = data

    def get_scene_data(self, scene_id: str):
        return self.scene_data.get(scene_id)

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket):
    scene_id = None
    session_id = None
    user = None

    try:
        await manager.connect(websocket)

        async for message in websocket.iter_text():
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "auth":
                    # Авторизация пользователя
                    user = data.get("user", {})
                    user["id"] = user.get("id", str(id(websocket)))
                    session_id = str(id(websocket))

                    await manager.send_message(websocket, {
                        "type": "auth",
                        "sessionId": session_id
                    })

                elif msg_type == "scene:join":
                    old_scene_id = scene_id
                    scene_id = data.get("sceneId")

                    if old_scene_id and old_scene_id in manager.scene_connections:
                        manager.scene_connections[old_scene_id].discard(websocket)
                        await manager.broadcast_user_left(old_scene_id, user.get("id") if user else "unknown")

                    if scene_id:
                        if scene_id not in manager.scene_connections:
                            manager.scene_connections[scene_id] = set()
                        manager.scene_connections[scene_id].add(websocket)
                        manager.user_info[websocket]["scene_id"] = scene_id

                        # Отправляем текущее состояние сцены
                        scene_data = manager.get_scene_data(scene_id)
                        if scene_data:
                            await manager.send_message(websocket, {
                                "type": "scene:sync",
                                "scene": scene_data
                            })

                        # Уведомляем других о новом пользователе
                        if user:
                            await manager.broadcast_user_joined(scene_id, user, websocket)

                elif msg_type == "scene:leave":
                    if scene_id:
                        manager.scene_connections[scene_id].discard(websocket)
                        if user:
                            await manager.broadcast_user_left(scene_id, user.get("id"))
                        scene_id = None
                        manager.user_info[websocket]["scene_id"] = None

                elif msg_type == "scene:change":
                    # Транслируем изменение всем в этой сцене
                    if scene_id:
                        change = data.get("change")
                        if change:
                            # Сохраняем изменение в данных сцены
                            scene_data = manager.get_scene_data(scene_id) or {"objects": {}, "rootObjects": []}

                            if change["type"] == "add":
                                scene_data["objects"][change["target"]] = change["data"]
                                if "parentId" not in change["data"]:
                                    scene_data["rootObjects"].append(change["target"])
                            elif change["type"] == "remove":
                                if change["target"] in scene_data["objects"]:
                                    del scene_data["objects"][change["target"]]
                                if change["target"] in scene_data["rootObjects"]:
                                    scene_data["rootObjects"].remove(change["target"])
                            elif change["type"] in ["update", "transform"]:
                                if change["target"] in scene_data["objects"]:
                                    if change["type"] == "transform":
                                        scene_data["objects"][change["target"]]["transform"] = {
                                            **scene_data["objects"][change["target"]].get("transform", {}),
                                            **change["data"]
                                        }
                                    else:
                                        scene_data["objects"][change["target"]].update(change["data"])

                            manager.update_scene_data(scene_id, scene_data)

                            await manager.broadcast_to_scene(scene_id, {
                                "type": "scene:change",
                                "change": change,
                                "userId": user.get("id") if user else None
                            }, websocket)

                elif msg_type == "scene:sync":
                    # Клиент отправил полную синхронизацию сцены
                    if scene_id:
                        scene = data.get("scene")
                        if scene:
                            manager.update_scene_data(scene_id, scene)
                            await manager.broadcast_to_scene(scene_id, {
                                "type": "scene:sync",
                                "scene": scene
                            }, websocket)

                elif msg_type == "scene:request-sync":
                    # Клиент запросил синхронизацию
                    if scene_id:
                        scene_data = manager.get_scene_data(scene_id)
                        if scene_data:
                            await manager.send_message(websocket, {
                                "type": "scene:sync",
                                "scene": scene_data
                            })

                elif msg_type == "controller:update":
                    # Транслируем состояние контроллера
                    if scene_id:
                        await manager.broadcast_to_scene(scene_id, {
                            "type": "controller:update",
                            "userId": user.get("id") if user else None,
                            "data": data.get("data")
                        }, websocket)

                elif msg_type == "selection:update":
                    # Транслируем выделение объекта
                    if scene_id:
                        await manager.broadcast_to_scene(scene_id, {
                            "type": "selection:update",
                            "userId": user.get("id") if user else None,
                            "data": data.get("data")
                        }, websocket)

                elif msg_type == "ping":
                    await manager.send_message(websocket, {
                        "type": "pong",
                        "timestamp": data.get("timestamp")
                    })

            except json.JSONDecodeError:
                print(f"[WS] Invalid JSON: {message[:100]}")
            except Exception as e:
                print(f"[WS] Error processing message: {e}")

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected")
    finally:
        if scene_id and user:
            await manager.broadcast_user_left(scene_id, user.get("id"))
        manager.disconnect(websocket)


