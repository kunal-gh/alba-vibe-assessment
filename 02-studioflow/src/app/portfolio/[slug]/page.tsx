
'use client';

import { PortfolioGrid } from '@/components/portfolio/portfolio-grid';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePhotographs } from '@/lib/data-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { PretextHeading } from '@/components/ui/pretext-heading';

const categoryDescriptions: Record<string, string> = {
    weddings: "Capturing the love, joy, and candid moments that make your wedding day unforgettable. From the grand ceremony to the intimate details, we tell your unique love story.",
    portraits: "Whether for professional headshots, family photos, or creative concepts, our portrait sessions are tailored to capture your essence in a relaxed and artful way.",
    "live-events": "From corporate functions and high-energy concerts to private parties and celebrations, we document the energy and key moments of any event with professionalism and a keen eye.",
    fashion: "Collaborating with designers and brands to create striking lookbooks, editorials, and campaign imagery that brings your collection to life with style and creativity.",
    street: "Finding beauty and narrative in the everyday. Our street photography captures the candid, fleeting moments of life in the city with an authentic, documentary style.",
    "ai-generated": "Exploring the frontiers of creativity with AI-generated imagery. A showcase of art that blends technology and imagination.",
};

const LoadingSkeleton = () => (
    <div className="container mx-auto px-4">
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );


export default function PortfolioCategoryPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const categoryTitle = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const { data: images, isLoading } = usePhotographs(slug);

  return (
    <div className="min-h-screen bg-background">
      {/* Back button — full width bar, always in flow, never absolute */}
      <div className="w-full pt-16 pb-0 px-4 md:px-8">
        <Link
          href="/#portfolio"
          aria-label="Back to All Portfolios"
          className="group inline-flex items-center gap-3 py-4 text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          {/* Animated pill */}
          <span className="relative flex items-center justify-center w-9 h-9 rounded-full border border-border bg-background shadow-sm group-hover:bg-muted group-hover:border-foreground/20 group-hover:-translate-x-1 transition-all duration-300">
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] select-none">
            Back
          </span>
        </Link>
      </div>

      {/* Page heading */}
      <div className="container mx-auto px-4 text-center py-8 md:py-12">
        <PretextHeading
          text={categoryTitle}
          className="font-bold tracking-tighter uppercase"
        />
        <p className="mt-4 md:mt-6 max-w-3xl mx-auto text-base md:text-lg text-muted-foreground px-4">
          {categoryDescriptions[slug] || "A collection of our finest work."}
        </p>
      </div>

      {/* Gallery */}
      <div className="container mx-auto px-4 pb-16">
        {isLoading && <LoadingSkeleton />}
        {!isLoading && images && images.length > 0 && <PortfolioGrid title="" images={images} />}
        {!isLoading && (!images || images.length === 0) && (
          <p className="text-center text-muted-foreground py-20">This gallery is empty for now. Check back soon!</p>
        )}
      </div>
    </div>
  );
}
