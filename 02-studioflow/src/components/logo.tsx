import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        className={cn("text-foreground", className)}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Through Hardik's Eye Logo"
    >
        {/* Abstract Camera Lens/Eye */}
        <path d="M12 15.5C14.2091 15.5 16 13.7091 16 11.5C16 9.29086 14.2091 7.5 12 7.5C9.79086 7.5 8 9.29086 8 11.5C8 13.7091 9.79086 15.5 12 15.5Z" />
        <path d="M2 11.5C2 11.5 5 4.5 12 4.5C19 4.5 22 11.5 22 11.5C22 11.5 19 18.5 12 18.5C5 18.5 2 11.5 2 11.5Z" />
        
        {/* Initials "T H E" subtly integrated */}
        {/* T */}
        <line x1="10" y1="10" x2="14" y2="10" />
        <line x1="12" y1="10" x2="12" y2="13" />

        {/* H */}
        <path d="M11 11.5H13" stroke="currentColor" strokeWidth="1" />
    </svg>
);
