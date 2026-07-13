"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function CubistImage({ src, alt, hint }: { src: string; alt: string; hint: string }) {

  return (
    <div
      className="relative w-full h-full overflow-hidden"
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-opacity duration-300"
        data-ai-hint={hint}
      />
    </div>
  );
}
