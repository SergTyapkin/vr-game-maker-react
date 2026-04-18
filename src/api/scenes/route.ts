// app/api/scenes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, readdir, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SCENES_DIR = join(process.cwd(), 'data', 'scenes');

export async function GET() {
  try {
    if (!existsSync(SCENES_DIR)) {
      await mkdir(SCENES_DIR, { recursive: true });
    }

    const files = await readdir(SCENES_DIR);
    const scenes = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(join(SCENES_DIR, file), 'utf-8');
        scenes.push(JSON.parse(content));
      }
    }

    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read scenes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Scene name is required' },
        { status: 400 }
      );
    }

    if (!existsSync(SCENES_DIR)) {
      await mkdir(SCENES_DIR, { recursive: true });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const scene = {
      id,
      name,
      description,
      objects: {},
      rootObjects: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      settings: {
        ambientLight: {
          color: '#404040',
          intensity: 0.5,
        },
      },
    };

    await writeFile(join(SCENES_DIR, `${id}.json`), JSON.stringify(scene, null, 2));

    return NextResponse.json({ scene });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create scene' },
      { status: 500 }
    );
  }
}
