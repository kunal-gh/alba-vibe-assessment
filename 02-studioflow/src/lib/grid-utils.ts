
/**
 * Dynamic grid spanning logic for the editorial portfolio gallery.
 * This pattern ensures a balanced mix of Large, Wide, Tall, and Small tiles.
 */
export function getEditorialGridSpan(index: number): string {
  const patterns = [
    "md:col-span-8 md:row-span-2", // 0: Large Featured
    "md:col-span-4 md:row-span-1", // 1: Secondary Square (Top)
    "md:col-span-4 md:row-span-1", // 2: Secondary Square (Bottom of 0/1 block)
    "md:col-span-3 md:row-span-2", // 3: Tall Sidebar
    "md:col-span-6 md:row-span-2", // 4: Regular Main
    "md:col-span-3 md:row-span-1", // 5: Small Accompanying
    "md:col-span-12 md:row-span-1", // 6: Full Width Statement
    "md:col-span-5 md:row-span-2", // 7: Left Heavy
    "md:col-span-7 md:row-span-2", // 8: Right Heavy Featured
  ];
  
  return patterns[index % patterns.length];
}

export function getEditorialRowHeight(index: number): string {
  // We can vary row heights slightly for a more organic feel, or keep them consistent.
  // Standardizing on '22rem' per base row gives a strong editorial presence.
  return "22rem";
}
