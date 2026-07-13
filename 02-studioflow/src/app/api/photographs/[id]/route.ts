export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ImageKit from "imagekit";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const photo = await prisma.photograph.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  try { 
    const imagekit = new ImageKit({
      publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "",
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
      urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "",
    });
    await imagekit.deleteFile(photo.imageKitFileId); 
  } catch (err) {
    console.error("Failed to delete from ImageKit", err);
  }
  await prisma.photograph.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const photo = await prisma.photograph.update({ where: { id: params.id }, data: body });
  return NextResponse.json(photo);
}