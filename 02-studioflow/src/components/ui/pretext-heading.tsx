"use client";
import React, { useEffect, useState, useRef } from "react";
import { prepareWithSegments, layoutWithLines, LayoutLine } from "@chenglou/pretext";

interface Props {
  text: string;
  font?: string;
  className?: string;
}

export function PretextHeading({ text, font = "clamp(3rem, 10vw, 8rem)", className }: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Split text by words for staggered animation
  const words = text.split(" ");

  return (
    <h1 
      className={className} 
      style={{ 
        fontSize: font,
        fontFamily: '"Playfair Display", serif',
        textWrap: "balance", 
        textAlign: "center",
        lineHeight: 1.05
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block opacity-0 translate-y-12 blur-sm mr-[0.25em]"
          style={{
            animation: isMounted ? `slideUpFade 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.15}s forwards` : "none"
          }}
        >
          {word}
        </span>
      ))}
      <style jsx>{`
        @keyframes slideUpFade {
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
      `}</style>
    </h1>
  );
}