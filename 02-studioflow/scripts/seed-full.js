const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const placeholderData = require('./src/lib/placeholder-images.json');

async function main() {
  try {
    console.log("Wiping database...");
    await prisma.photograph.deleteMany({});
    await prisma.section.deleteMany({});
    await prisma.testimonial.deleteMany({});
    await prisma.contact.deleteMany({});
    await prisma.settings.deleteMany({});

    console.log("Creating settings...");
    await prisma.settings.create({
      data: {
        id: "global",
        email: "hello@photopholio.com",
        phone: "+1 (555) 123-4567",
        instagram: "photopholio_ai",
        twitter: "photopholio",
        facebook: "photopholio_official"
      }
    });

    console.log("Creating sections...");
    const baseCategories = ["Wedding", "Portrait", "Events", "Fashion", "Concerts", "Street", "AI Art", "General"];
    
    for (const [index, catName] of baseCategories.entries()) {
      await prisma.section.create({
        data: {
          name: catName,
          slug: catName.toLowerCase().replace(/\s+/g, '-'),
          description: `Beautiful ${catName.toLowerCase()} photography series.`,
          order: index
        }
      });
    }

    console.log("Creating photos from placeholder data...");
    for (const img of placeholderData.placeholderImages) {
      let sectionName = "General";
      if (img.id.includes("wedding")) sectionName = "Wedding";
      if (img.id.includes("portrait")) sectionName = "Portrait";
      if (img.id.includes("event")) sectionName = "Events";
      if (img.id.includes("fashion")) sectionName = "Fashion";
      if (img.id.includes("concert")) sectionName = "Concerts";
      if (img.id.includes("street")) sectionName = "Street";
      if (img.id.includes("ai")) sectionName = "AI Art";

      await prisma.photograph.create({
        data: {
          title: img.imageHint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: img.description,
          section: sectionName,
          imageUrl: img.imageUrl,
          imageKitFileId: img.id,
          featured: Math.random() > 0.7
        }
      });
    }

    console.log("Generating additional AI generated photos...");
    for(let i=1; i<=30; i++) {
        await prisma.photograph.create({
            data: {
                title: `AI Generation ${i}`,
                description: `A stunning AI generated artwork showcasing futuristic and surreal concepts. Piece number ${i}.`,
                section: "AI Art",
                imageUrl: `https://picsum.photos/seed/photopholio-ai-${i}/800/600`,
                imageKitFileId: `ai-gen-${i}`,
                featured: Math.random() > 0.8
            }
        });
    }

    console.log("Generating 25 more random photos for various categories...");
    for(let i=1; i<=25; i++) {
        const randomCat = baseCategories[Math.floor(Math.random() * baseCategories.length)];
        await prisma.photograph.create({
            data: {
                title: `Random Capture ${i}`,
                description: `An amazing additional shot for the ${randomCat} category. Piece number ${i}.`,
                section: randomCat,
                imageUrl: `https://picsum.photos/seed/photopholio-random-${i}-${randomCat}/800/600`,
                imageKitFileId: `random-gen-${i}`,
                featured: Math.random() > 0.8
            }
        });
    }

    console.log("Generating testimonials...");
    const reviewers = [
        {name: "Alice Johnson", role: "Bride", text: "The wedding photos were absolutely stunning! Captured every moment perfectly."},
        {name: "Mark Davis", role: "Event Organizer", text: "Highly professional and the event photos were top notch. Will hire again!"},
        {name: "Sarah Lee", role: "Model", text: "Amazing portrait session. The AI elements added a unique flair to the standard shots."},
        {name: "James Wilson", role: "Art Director", text: "Incredible attention to detail. The AI art section is mind-blowing."},
        {name: "Emily Clark", role: "Musician", text: "Caught the energy of our concert beautifully. The colors and lighting are perfect."},
        {name: "Michael Brown", role: "Groom", text: "We couldn't be happier with our wedding album. Truly memories that will last a lifetime."},
        {name: "Jessica Taylor", role: "Fashion Designer", text: "The runway shots were pristine. Really highlighted the garments."},
        {name: "David Anderson", role: "Client", text: "A fantastic eye for street photography. The city really comes alive."},
    ];

    for(let i=0; i<reviewers.length; i++) {
        await prisma.testimonial.create({
            data: {
                author: reviewers[i].name,
                role: reviewers[i].role,
                text: reviewers[i].text,
                rating: 5,
                avatar: `https://picsum.photos/seed/user-${i}/150/150`
            }
        });
    }

    console.log("Generating sample contact messages...");
    for(let i=1; i<=5; i++) {
        await prisma.contact.create({
            data: {
                name: `Potential Client ${i}`,
                email: `client${i}@example.com`,
                message: `Hi, I am interested in booking a session for an upcoming event. Please let me know your availability and rates. Thanks!`,
                read: i % 2 === 0
            }
        });
    }

    console.log("Database seeded successfully with massive sample data!");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
