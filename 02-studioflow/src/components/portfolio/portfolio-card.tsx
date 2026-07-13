
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ImagePlaceholder } from '@/lib/placeholder-images';
import { ArrowRight } from 'lucide-react';

interface PortfolioCardProps {
  slug: string;
  title: string;
  description: string;
  coverImage: ImagePlaceholder;
  className?: string;
  sharp?: boolean;
}

export function PortfolioCard({ slug, title, description, coverImage, className, sharp = false }: PortfolioCardProps) {
  return (
    <Link 
      href={`/portfolio/${slug}`} 
      className={cn(
        "group relative block w-full h-full overflow-hidden transition-all duration-700", 
        className, 
        !sharp && "rounded-sm"
      )}
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={coverImage.imageUrl}
          alt={coverImage.description}
          fill
          className="object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          data-ai-hint={coverImage.imageHint}
          priority
        />
        <div className="absolute inset-0 bg-neutral-900/10 group-hover:bg-neutral-900/40 transition-colors duration-500" />
      </div>

      {/* Editorial Text Overlays */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-white">
        <div className="overflow-hidden mb-2">
          <span className="block text-[0.65rem] md:text-[0.75rem] font-headline font-medium uppercase tracking-[0.4em] translate-y-full group-hover:translate-y-0 transition-transform duration-500 delay-100 ease-out">
            Collection — 00{Math.floor(Math.random() * 9) + 1}
          </span>
        </div>
        
        <div className="relative">
          <h3 
            className="font-headline font-semibold uppercase tracking-tighter text-center leading-[0.8] select-none text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            style={{ fontSize: "clamp(2rem, 8vw, 6rem)" }}
          >
            {title.split(' ').map((word, i) => (
              <span 
                key={i} 
                className="block md:inline-block relative overflow-hidden"
              >
                <span className="block transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-[200%]">
                  {word}
                </span>
                <span className="absolute top-0 left-0 w-full text-center block transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] translate-y-[200%] group-hover:translate-y-0 text-white/90">
                  {word}
                </span>
              </span>
            ))}
          </h3>
        </div>

        <div className="overflow-hidden mt-6">
          <p className="font-headline text-[0.7rem] md:text-[0.8rem] font-light max-w-[200px] text-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-200 uppercase tracking-widest leading-loose">
            {description}
          </p>
        </div>
      </div>
      
      {/* Decorative Border on Hover */}
      <div className="absolute inset-4 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    </Link>
  );
}

