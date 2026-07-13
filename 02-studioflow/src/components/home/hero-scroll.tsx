"use client";

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { useScrollProgress } from '@/hooks/use-scroll-progress';
import { cn } from '@/lib/utils';
import { ArrowDown } from 'lucide-react';

interface HeroScrollProps {
  images: string[];
}

export function HeroScroll({ images }: HeroScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useScrollProgress(scrollRef);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const frameIndex = Math.min(
    images.length - 1,
    Math.floor(scrollProgress * images.length)
  );

  return (
    <div ref={scrollRef} className="relative h-[200vh] w-full">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        
        {/* Animated Images */}
        {isClient && images.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt={`Hero image ${index + 1}`}
            fill
            priority={index < 2}
            className={cn(
              'object-cover transition-opacity duration-1000 ease-in-out',
              index === frameIndex ? 'opacity-100' : 'opacity-0'
            )}
          />
        ))}

        {/* Fallback for SSR or no images */}
        {!isClient && images.length > 0 && (
          <Image
            src={images[0]}
            alt="Hero image"
            fill
            priority
            className="object-cover"
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-background/20"></div>
      </div>
    </div>
  );
}
