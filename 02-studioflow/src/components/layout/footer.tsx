import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground">
            &copy; {year} Through Hardik's Eye
          </p>
          <div className="flex items-center gap-4">
            {/* Social icons moved to header */}
          </div>
        </div>
      </div>
    </footer>
  );
}
