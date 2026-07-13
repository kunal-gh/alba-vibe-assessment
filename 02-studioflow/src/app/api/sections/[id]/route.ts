import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, order } = body;

    const existing = await prisma.section.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim();
      updateData.slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      // Rename photos in this section too
      if (name.trim() !== existing.name) {
        await prisma.photograph.updateMany({
          where: { section: existing.name },
          data: { section: name.trim() },
        });
      }
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (order !== undefined) updateData.order = order;

    const updated = await prisma.section.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A section with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const section = await prisma.section.findUnique({ where: { id: params.id } });
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Archive photos: move to "Archived" section
    const ARCHIVE_NAME = 'Archived';
    const ARCHIVE_SLUG = 'archived';

    // Ensure Archive section exists
    await prisma.section.upsert({
      where: { slug: ARCHIVE_SLUG },
      update: {},
      create: { name: ARCHIVE_NAME, slug: ARCHIVE_SLUG, description: 'Archived photos from deleted sections', order: 9999 },
    });

    // Move all photos from deleted section to Archive
    await prisma.photograph.updateMany({
      where: { section: section.name },
      data: { section: ARCHIVE_NAME },
    });

    // Delete the section
    await prisma.section.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
