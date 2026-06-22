import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';


export async function POST(request) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Extract public_id from Cloudinary URL
    const parts = url.split('/upload/');
    if (parts.length !== 2) {
      return NextResponse.json({ error: "Invalid Cloudinary URL" }, { status: 400 });
    }

    const path = parts[1];
    // Remove the version prefix if it exists
    const pathWithoutVersion = path.replace(/^v\d+\//, '');
    // Remove the file extension
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));

    if (!publicId) {
      return NextResponse.json({ error: "Could not extract public ID" }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
