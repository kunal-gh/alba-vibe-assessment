export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'global' }
    });
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'global' }
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate or sanitize body entries you wish to update
    const updateData = {
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.instagram !== undefined && { instagram: body.instagram }),
      ...(body.twitter !== undefined && { twitter: body.twitter }),
      ...(body.facebook !== undefined && { facebook: body.facebook }),
    };

    const updatedSettings = await prisma.settings.upsert({
      where: { id: 'global' },
      update: updateData,
      create: {
        id: 'global',
        ...updateData
      }
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Failed to update settings", error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
