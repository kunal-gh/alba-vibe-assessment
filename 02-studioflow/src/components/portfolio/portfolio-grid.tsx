
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ImageInfo {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  imageHint?: string;
}

interface PortfolioGridProps {
  title: string;
  images: ImageInfo[];
  layout?: "A" | "B" | "C";
}

export function PortfolioGrid({ title, images }: PortfolioGridProps) {
  if (!images || images.length === 0) return (
    <div className="container mx-auto px-4 text-center">
      <p className="text-muted-foreground">No images to display in this category.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4">
      {title && (
        <h2 className="font-headline text-4xl md:text-5xl font-semibold tracking-tight mb-12 text-center">
          {title}
        </h2>
      )}
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {images.map((image, index) => (
          <div key={image.id} className="break-inside-avoid">
            <Image
              src={image.imageUrl}
              alt={image.description || 'Portfolio image'}
              width={500}
              height={500}
              className="object-cover w-full h-auto rounded-lg shadow-md transition-transform duration-300 ease-in-out hover:scale-105"
              priority={index < 8}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
