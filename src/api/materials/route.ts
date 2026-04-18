// app/api/materials/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MATERIALS_DIR = join(process.cwd(), 'data', 'materials');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = join(MATERIALS_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    const content = await readFile(filePath, 'utf-8');
    const material = JSON.parse(content);

    return NextResponse.json({ material });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read material' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const filePath = join(MATERIALS_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    // Читаем существующий материал
    const content = await readFile(filePath, 'utf-8');
    const material = JSON.parse(content);

    // Обновляем поля
    const updatedMaterial = {
      ...material,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(filePath, JSON.stringify(updatedMaterial, null, 2));

    return NextResponse.json({ material: updatedMaterial });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = join(MATERIALS_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    );
  }
}
