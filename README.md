# WebXR App

## Project run

### 1. Clone repo

```
git clone git@git.sberrobots.ru:development/rsf/rms/ui/oculus-widget.git

git lfs fetch --all
```

### 2. Build and Run

```bash
docker compose -f docker/docker-compose.yaml build webxr
# and run
docker compose -f docker/docker-compose.yaml up webxr
```

### 3. For develop

```bash
docker compose -f docker/docker-compose.yaml build webxr-dev
# and run
docker compose -f docker/docker-compose.yaml up webxr-dev
```



## Controller and Hand Tracking via WebSockets

### 1. Run docker container as show above

### 2. Run [signaling server](https://git.sberrobots.ru/development/rsf/rms/widgets/server)
#### By default it is starts on 8000 port, you can change it in docker-compose.yml

### 3. Run your webscoket client:

```python
import asyncio
import json
from uuid import uuid1

import websockets


async def get():
    client_id = str(uuid1())
    
    signaling: str = "localhost:8000"
    control: str = "controllers" # or hand_control
    robot_id: str = "TheFirst"

    url: str = f"wss://{signaling}/{control}/{robot_id}.ws?client_id={client_id}"

    async with websockets.connect(url) as ws:
        print(f"Connected to {url}")

        await ws.send(json.dumps({"id": client_id, "type": control}))
        async for msg in ws:
            try:
                data = json.loads(msg)
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except json.JSONDecodeError:
                print(msg)


if __name__ == "__main__":
    asyncio.run(get())
```