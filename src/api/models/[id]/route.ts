// app/api/models/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MODELS_DIR = join(process.cwd(), 'public', 'assets', 'models');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileName = Buffer.from(params.id, 'base64').toString();
    const filePath = join(MODELS_DIR, fileName);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    // Здесь можно добавить парсинг метаданных модели
    return NextResponse.json({
      model: {
        id: params.id,
        name: fileName,
        url: `/assets/models/${fileName}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read model' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileName = Buffer.from(params.id, 'base64').toString();
    const filePath = join(MODELS_DIR, fileName);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    // Удаляем основной файл
    await unlink(filePath);

    // Удаляем превью если есть
    const thumbnailName = fileName.replace(/\.[^.]+$/, '_thumb.jpg');
    const thumbnailPath = join(MODELS_DIR, thumbnailName);
    if (existsSync(thumbnailPath)) {
      await unlink(thumbnailPath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
