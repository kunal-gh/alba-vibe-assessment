export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  
  const photos = await prisma.photograph.findMany({
    where: section ? { section: { equals: section, mode: 'insensitive' } } : undefined,
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json(photos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, section, imageUrl, imageKitFileId, width, height, featured, tags, eventDate } = body;
  
  if (!title || !section || !imageUrl || !imageKitFileId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  
  const photo = await prisma.photograph.create({
    data: { 
      title, 
      description, 
      section, 
      imageUrl, 
      imageKitFileId, 
      width, 
      height, 
      featured: featured ?? false, 
      tags,
      eventDate: eventDate ? new Date(eventDate) : null
    },
  });
  return NextResponse.json(photo, { status: 201 });
}