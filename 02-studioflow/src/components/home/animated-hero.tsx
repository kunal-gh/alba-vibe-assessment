
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageInfo {
  id: string;
  imageUrl: string;
  description: string;
  imageHint: string;
}

interface AnimatedHeroProps {
  images: ImageInfo[];
}

export function AnimatedHero({ images }: AnimatedHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5500); // Change image every 5.5 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <>
      {images.map((image, index) => (
        <div
          key={image.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-[2000ms] ease-in-out z-0",
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="relative w-full h-full shadow-2xl overflow-hidden">
            <Image
              src={image.imageUrl}
              alt={image.description}
              fill
              priority={index === 0}
              className={cn(
                "object-cover transition-all duration-[6000ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                index === currentIndex ? "scale-100 blur-[0px]" : "scale-110 blur-[8px]"
              )}
              data-ai-hint={image.imageHint}
            />
          </div>
        </div>
      ))}
    </>
  );
}
