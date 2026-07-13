import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import placeholderData from "@/lib/placeholder-images.json";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Wipe existing sections and photos
    await prisma.photograph.deleteMany({});
    await prisma.section.deleteMany({});

    // 2. Map existing placeholders into logical categories
    const categories = Array.from(new Set(placeholderData.placeholderImages.map(img => {
      if (img.id.includes("wedding")) return "Wedding";
      if (img.id.includes("portrait")) return "Portrait";
      if (img.id.includes("event")) return "Events";
      if (img.id.includes("fashion")) return "Fashion";
      if (img.id.includes("concert")) return "Concerts";
      if (img.id.includes("street")) return "Street";
      if (img.id.includes("ai")) return "AI Art";
      return "General";
    })));

    // 3. Create Sections
    for (const [index, catName] of categories.entries()) {
      await prisma.section.create({
        data: {
          name: catName,
          slug: catName.toLowerCase().replace(/\s+/g, '-'),
          description: `Beautiful ${catName.toLowerCase()} photography series.`,
          order: index
        }
      });
    }

    // 4. Create Photos
    for (const img of placeholderData.placeholderImages) {
      let sectionName = "General";
      if (img.id.includes("wedding")) sectionName = "Wedding";
      if (img.id.includes("portrait")) sectionName = "Portrait";
      if (img.id.includes("event")) sectionName = "Events";
      if (img.id.includes("fashion")) sectionName = "Fashion";
      if (img.id.includes("concert")) sectionName = "Concerts";
      if (img.id.includes("street")) sectionName = "Street";
      if (img.id.includes("ai")) sectionName = "AI Art";

      await prisma.photograph.create({
        data: {
          title: img.imageHint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: img.description,
          section: sectionName,
          imageUrl: img.imageUrl,
          imageKitFileId: img.id, // Mock FileID
          featured: Math.random() > 0.7 // Randomly feature about 30% of photos
        }
      });
    }

    return NextResponse.json({ success: true, message: "Database aggressively seeded with stunning placeholder items!" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
