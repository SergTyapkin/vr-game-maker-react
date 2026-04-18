// app/api/scripts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SCRIPTS_DIR = join(process.cwd(), 'public', 'assets', 'scripts');

export interface ScriptFile {
  path: string;
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export interface ScriptDirectory {
  path: string;
  name: string;
  children: (ScriptFile | ScriptDirectory)[];
}

// Рекурсивное чтение директории
async function readScriptsDirectory(dirPath: string, relativePath: string = ''): Promise<(ScriptFile | ScriptDirectory)[]> {
  const items: (ScriptFile | ScriptDirectory)[] = [];
  const fullPath = join(SCRIPTS_DIR, relativePath);

  if (!existsSync(fullPath)) {
    return items;
  }

  const entries = await readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const itemPath = join(relativePath, entry.name);
    const fullItemPath = join(SCRIPTS_DIR, itemPath);

    if (entry.isDirectory()) {
      items.push({
        path: '/' + itemPath.replace(/\\/g, '/'),
        name: entry.name,
        children: await readScriptsDirectory(fullItemPath, itemPath),
      });
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      const stats = await stat(fullItemPath);
      const content = await readFile(fullItemPath, 'utf-8');

      items.push({
        path: '/' + itemPath.replace(/\\/g, '/'),
        name: entry.name,
        content,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  }

  return items.sort((a, b) => {
    // Директории первыми
    if ('children' in a && !('children' in b)) return -1;
    if (!('children' in a) && 'children' in b) return 1;
    return a.name.localeCompare(b.name);
  });
}

// GET /api/scripts - получить дерево файлов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    // Создаем директорию если не существует
    if (!existsSync(SCRIPTS_DIR)) {
      await mkdir(SCRIPTS_DIR, { recursive: true });

      // Создаем примеры файлов
      await createExampleScripts();
    }

    if (filePath) {
      // Возвращаем содержимое конкретного файла
      const fullPath = join(SCRIPTS_DIR, filePath);

      if (!existsSync(fullPath)) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      const content = await readFile(fullPath, 'utf-8');
      const stats = await stat(fullPath);

      return NextResponse.json({
        file: {
          path: filePath,
          name: filePath.split('/').pop() || '',
          content,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        },
      });
    }

    // Возвращаем дерево файлов
    const tree = await readScriptsDirectory(SCRIPTS_DIR);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Error reading scripts:', error);
    return NextResponse.json(
      { error: 'Failed to read scripts' },
      { status: 500 }
    );
  }
}

// POST /api/scripts - создать/обновить файл
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, content, action = 'save' } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    const fullPath = join(SCRIPTS_DIR, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('\\'));

    // Создаем директорию если не существует
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (action === 'delete') {
      if (existsSync(fullPath)) {
        await import('fs/promises').then(fs => fs.unlink(fullPath));
      }
      return NextResponse.json({ success: true });
    }

    // Сохраняем файл
    await writeFile(fullPath, content || '');

    const stats = await stat(fullPath);

    return NextResponse.json({
      file: {
        path,
        name: path.split('/').pop() || '',
        content: content || '',
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving script:', error);
    return NextResponse.json(
      { error: 'Failed to save script' },
      { status: 500 }
    );
  }
}

// Создание примеров скриптов
async function createExampleScripts() {
  const examples = {
    '/behaviors/DoorController.js': `export default {
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
};`,
    '/behaviors/MovableObject.js': `export default {
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
};`,
    '/utils/helpers.js': `export function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`,
  };

  for (const [path, content] of Object.entries(examples)) {
    const fullPath = join(SCRIPTS_DIR, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('\\'));

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, content);
  }
}
