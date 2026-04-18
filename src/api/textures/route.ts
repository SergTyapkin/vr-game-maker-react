// app/api/textures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEXTURES_DIR = join(process.cwd(), 'public', 'assets', 'textures');

export interface TextureData {
  id: string;
  name: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
  format: string;
  uploadedAt: string;
}

// GET /api/textures - получить список всех текстур
export async function GET() {
  try {
    // Создаем директорию если не существует
    if (!existsSync(TEXTURES_DIR)) {
      await mkdir(TEXTURES_DIR, { recursive: true });
    }

    const files = await readdir(TEXTURES_DIR);
    const textures: TextureData[] = [];

    for (const file of files) {
      const filePath = join(TEXTURES_DIR, file);
      const stats = await stat(filePath);

      if (stats.isFile()) {
        const ext = file.split('.').pop()?.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext || '')) {
          textures.push({
            id: Buffer.from(file).toString('base64'),
            name: file,
            url: `/assets/textures/${file}`,
            size: stats.size,
            format: ext || 'unknown',
            uploadedAt: stats.mtime.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ textures });
  } catch (error) {
    console.error('Error reading textures:', error);
    return NextResponse.json(
      { error: 'Failed to read textures' },
      { status: 500 }
    );
  }
}

// POST /api/textures - загрузить новую текстуру
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

    // Проверяем формат
    const validFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !validFormats.includes(ext)) {
      return NextResponse.json(
        { error: 'Invalid file format. Supported: PNG, JPG, JPEG, WEBP, BMP' },
        { status: 400 }
      );
    }

    // Создаем директорию если не существует
    if (!existsSync(TEXTURES_DIR)) {
      await mkdir(TEXTURES_DIR, { recursive: true });
    }

    // Сохраняем файл
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(TEXTURES_DIR, fileName);

    await writeFile(filePath, buffer);

    const stats = await stat(filePath);

    const texture: TextureData = {
      id: Buffer.from(fileName).toString('base64'),
      name: fileName,
      url: `/assets/textures/${fileName}`,
      size: stats.size,
      format: ext,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ texture });
  } catch (error) {
    console.error('Error uploading texture:', error);
    return NextResponse.json(
      { error: 'Failed to upload texture' },
      { status: 500 }
    );
  }
}
