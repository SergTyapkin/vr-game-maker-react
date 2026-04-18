// app/api/models/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MODELS_DIR = join(process.cwd(), 'public', 'assets', 'models');

export interface ModelData {
  id: string;
  name: string;
  url: string;
  size: number;
  format: string;
  uploadedAt: string;
  thumbnail?: string;
  metadata?: {
    vertices?: number;
    triangles?: number;
    materials?: string[];
    animations?: string[];
  };
}

// GET /api/models - получить список всех моделей
export async function GET() {
  try {
    if (!existsSync(MODELS_DIR)) {
      await mkdir(MODELS_DIR, { recursive: true });
    }

    const files = await readdir(MODELS_DIR);
    const models: ModelData[] = [];

    for (const file of files) {
      const filePath = join(MODELS_DIR, file);
      const stats = await stat(filePath);

      if (stats.isFile()) {
        const ext = file.split('.').pop()?.toLowerCase();
        if (['gltf', 'glb', 'fbx', 'obj'].includes(ext || '')) {
          // Проверяем наличие превью
          const thumbnailName = file.replace(/\.[^.]+$/, '_thumb.jpg');
          const thumbnailPath = join(MODELS_DIR, thumbnailName);
          const thumbnail = existsSync(thumbnailPath) ? `/assets/models/${thumbnailName}` : undefined;

          models.push({
            id: Buffer.from(file).toString('base64'),
            name: file,
            url: `/assets/models/${file}`,
            size: stats.size,
            format: ext || 'unknown',
            uploadedAt: stats.mtime.toISOString(),
            thumbnail,
          });
        }
      }
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error reading models:', error);
    return NextResponse.json(
      { error: 'Failed to read models' },
      { status: 500 }
    );
  }
}

// POST /api/models - загрузить новую модель
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const validFormats = ['gltf', 'glb', 'fbx', 'obj'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !validFormats.includes(ext)) {
      return NextResponse.json(
        { error: 'Invalid file format. Supported: GLTF, GLB, FBX, OBJ' },
        { status: 400 }
      );
    }

    if (!existsSync(MODELS_DIR)) {
      await mkdir(MODELS_DIR, { recursive: true });
    }

    // Сохраняем файл
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(MODELS_DIR, fileName);

    await writeFile(filePath, buffer);

    const stats = await stat(filePath);

    const model: ModelData = {
      id: Buffer.from(fileName).toString('base64'),
      name: fileName,
      url: `/assets/models/${fileName}`,
      size: stats.size,
      format: ext,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ model });
  } catch (error) {
    console.error('Error uploading model:', error);
    return NextResponse.json(
      { error: 'Failed to upload model' },
      { status: 500 }
    );
  }
}
