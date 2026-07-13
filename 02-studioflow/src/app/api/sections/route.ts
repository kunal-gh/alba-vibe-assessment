export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      orderBy: { order: 'asc' },
    });

    // Attach photo count to each section
    const sectionsWithCount = await Promise.all(
      sections.map(async (section) => {
        const count = await prisma.photograph.count({
          where: { section: section.name },
        });
        return { ...section, photoCount: count };
      })
    );

    return NextResponse.json(sectionsWithCount);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Get max order for positioning at end
    const maxOrder = await prisma.section.aggregate({ _max: { order: true } });
    const order = (maxOrder._max.order ?? -1) + 1;

    const section = await prisma.section.create({
      data: { name: name.trim(), slug, description: description?.trim() || null, order },
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A section with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
  }
}
