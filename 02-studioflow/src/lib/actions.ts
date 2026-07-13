
"use server";

import { z } from "zod";
import { prisma } from "./prisma";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

export async function submitContactForm(formData: FormData) {
  const data = Object.fromEntries(formData);
  const parsed = contactSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Save to database
    await prisma.contact.create({
      data: parsed.data
    });
    
    return {
      success: true,
      message: "Thank you for your message! I'll get back to you soon.",
    };
  } catch (error) {
    console.error("Failed to save contact:", error);
    return {
      success: false,
      message: "Failed to send message. Please try again.",
    };
  }
}
