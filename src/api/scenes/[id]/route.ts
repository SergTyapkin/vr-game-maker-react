// app/api/scenes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SCENES_DIR = join(process.cwd(), 'data', 'scenes');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = join(SCENES_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    const content = await readFile(filePath, 'utf-8');
    const scene = JSON.parse(content);

    return NextResponse.json({ scene });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read scene' },
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
    const filePath = join(SCENES_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    const scene = body.scene;
    scene.metadata.updatedAt = new Date().toISOString();
    scene.metadata.version++;

    await writeFile(filePath, JSON.stringify(scene, null, 2));

    return NextResponse.json({ scene });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = join(SCENES_DIR, `${params.id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete scene' },
      { status: 500 }
    );
  }
}
