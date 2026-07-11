"use server";

import { v2 as cloudinary } from 'cloudinary';

export async function uploadImageAction(formData) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    
    const file = formData.get('file');

    if (!file) {
      throw new Error("No file provided");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary via a stream
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "nexus_notes" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return { url: result.secure_url };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw new Error(error.message || "Failed to upload to Cloudinary");
  }
}
