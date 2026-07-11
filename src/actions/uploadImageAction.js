"use server";

import { v2 as cloudinary } from 'cloudinary';

export async function generateCloudinarySignature() {
  try {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const folder = "nexus_notes";

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      timestamp,
      signature,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    };
  } catch (error) {
    console.error("Cloudinary Signature Error:", error);
    throw new Error(error.message || "Failed to generate Cloudinary signature");
  }
}
