
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useTestimonials } from '@/lib/data-provider';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import React from 'react';


const Rating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-1 text-yellow-400">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={i < rating ? "fill-current" : ""} />
    ))}
  </div>
);

const sampleTestimonials = [
    {
      author: "Jessica & Tom",
      text: "Hardik didn't just take photos; he captured the soul of our wedding day. We look at our album and relive every laugh, tear, and dance. Truly magical.",
      role: "Wedding Client",
      avatar: "https://i.pravatar.cc/150?img=1",
      rating: 5,
    },
    {
      author: "Amina Yusuf",
      text: "The portrait session was so relaxed and professional. Hardik made me feel completely at ease, and the final shots are the best photos I've ever had taken.",
      role: "Portrait Client",
      avatar: "https://i.pravatar.cc/150?img=5",
      rating: 5,
    },
    {
      author: "David Chen",
      text: "His eye for street photography is unmatched. The photos he took for our magazine feature were raw, powerful, and told an incredible story.",
      role: "Magazine Editor",
      avatar: "https://i.pravatar.cc/150?img=8",
      rating: 5,
    },
    {
        author: "Sarah Jenkins",
        text: "The fashion shoot was a dream. The creativity and direction were top-notch, resulting in a stunning lookbook that exceeded all our expectations.",
        role: "Fashion Designer",
        avatar: "https://i.pravatar.cc/150?img=12",
        rating: 5,
    },
    {
        author: "Michael B.",
        text: "Incredible ability to capture the energy of a live event. The photos from our conference are dynamic and professional. Highly recommended.",
        role: "Event Organizer",
        avatar: "https://i.pravatar.cc/150?img=11",
        rating: 5,
    }
  ];

function TestimonialsContent() {
    const { data: testimonialsFromDB, isLoading } = useTestimonials();
    
    const testimonials = testimonialsFromDB && testimonialsFromDB.length > 0 ? testimonialsFromDB : sampleTestimonials;

    return (
        <>
            {isLoading && <p className="text-center text-muted-foreground">Loading testimonials...</p>}

            {testimonials && testimonials.length > 0 && (
            <CarouselContent>
                {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} index={index} className="sm:basis-1/2 lg:basis-1/3 p-4">
                    <Card className="h-full flex flex-col items-center text-center p-8 border border-border/20 shadow-sm bg-card/20 rounded-lg testimonial-card transition-all duration-300">
                    <Avatar className="w-24 h-24 mb-6 border-4 border-background shadow-md">
                        <AvatarImage src={testimonial.avatar} alt={testimonial.author} />
                        <AvatarFallback>{testimonial.author.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <CardContent className="p-0 flex-grow">
                        <p className="text-base italic text-foreground/70 mb-6">"{testimonial.text}"</p>
                        <h3 className="font-headline text-xl font-semibold text-foreground">{testimonial.author}</h3>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                        {testimonial.rating && <div className="mt-4"><Rating rating={testimonial.rating} /></div>}
                    </CardContent>
                    </Card>
                </CarouselItem>
                ))}
            </CarouselContent>
            )}

            {!isLoading && (!testimonials || testimonials.length === 0) && (
            <p className="text-center text-muted-foreground">No testimonials yet.</p>
            )}
        </>
    );
}

export default function TestimonialsPage() {

  return (
    <div className="py-20 md:py-28 lg:py-32 bg-background">
      <div className="container mx-auto px-4 relative">
        <div className="absolute top-8 left-4 md:left-8 z-10">
            <Button asChild variant="outline" size="lg" className="rounded-full w-14 h-14 p-0">
                <Link href="/" aria-label="Back to Home">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
            </Button>
        </div>

        <div className="text-center mb-12 md:mb-20">
          <h1 className="font-headline text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">Client Voices</h1>
          <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground">
            Stories from those who have trusted me to capture their most precious moments.
          </p>
        </div>
        
        <Carousel
            opts={{
              align: "start",
              loop: true,
              dragFree: true,
            }}
            className="w-full max-w-6xl mx-auto"
          >
            <TestimonialsContent />
            <CarouselPrevious className="left-[-50px] text-foreground/50 hover:text-foreground hidden md:flex" />
            <CarouselNext className="right-[-50px] text-foreground/50 hover:text-foreground hidden md:flex" />
        </Carousel>
      </div>
    </div>
  );
}
