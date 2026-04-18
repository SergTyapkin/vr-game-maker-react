// app/api/textures/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unlink, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEXTURES_DIR = join(process.cwd(), 'public', 'assets', 'textures');

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileName = Buffer.from(params.id, 'base64').toString();
    const filePath = join(TEXTURES_DIR, fileName);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Texture not found' },
        { status: 404 }
      );
    }

    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting texture:', error);
    return NextResponse.json(
      { error: 'Failed to delete texture' },
      { status: 500 }
    );
  }
}
