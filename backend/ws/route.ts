// app/api/ws/route.ts
import { WebSocketServer } from 'ws';
import { watch } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';

const SCRIPTS_DIR = join(process.cwd(), 'public', 'assets', 'scripts');

// Храним активные соединения
const clients = new Set<any>();

// Функция для инициализации WebSocket сервера
export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    clients.add(ws);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'hot-reload') {
          // Клиент запросил горячую перезагрузку
          broadcast({
            type: 'hot-reload',
            file: data.file,
            content: data.content,
          });
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });
  });

  // Наблюдаем за изменениями файлов
  watchScriptsDirectory(wss);
}

// Наблюдение за изменениями в директории скриптов
function watchScriptsDirectory(wss: WebSocketServer) {
  const watcher = watch(SCRIPTS_DIR, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;

    try {
      const filePath = join(SCRIPTS_DIR, filename);
      const content = await readFile(filePath, 'utf-8');

      broadcast({
        type: 'file-changed',
        file: filename,
        content,
      });
    } catch (error) {
      console.error('[WebSocket] Error reading changed file:', error);
    }
  });

  process.on('SIGTERM', () => {
    watcher.close();
  });
}

// Рассылка сообщения всем клиентам
function broadcast(message: any) {
  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(messageStr);
    }
  });
}

// API route для WebSocket
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response('WebSocket endpoint', { status: 426 });
}

export async function SOCKET(req: Request) {
  // Этот метод будет вызван для WebSocket соединений
  // Требуется настройка в next.config.js
}
