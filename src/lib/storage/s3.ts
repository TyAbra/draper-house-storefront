/**
 * S3 image upload utility.
 *
 * Required environment variables:
 *   AWS_S3_BUCKET         - e.g. "draper-house-images"
 *   AWS_S3_REGION         - e.g. "us-east-1"
 *   AWS_ACCESS_KEY_ID     - IAM user access key
 *   AWS_SECRET_ACCESS_KEY - IAM user secret key
 *
 * IAM policy needed (minimum):
 *   s3:PutObject on arn:aws:s3:::YOUR_BUCKET/uploads/*
 *   s3:DeleteObject on arn:aws:s3:::YOUR_BUCKET/uploads/*  (for future delete support)
 *
 * Bucket must have:
 *   - Public read on objects under uploads/ (Block Public Access OFF for those objects),
 *     OR a CloudFront distribution in front of the bucket.
 *
 * Install the SDK before use:
 *   npm install @aws-sdk/client-s3
 */

export type UploadResult =
  | { success: true; imageUrl: string; key: string }
  | { success: false; error: string };

function getS3Config(): { bucket: string; region: string } {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION;

  if (!bucket || !region) {
    throw new Error("AWS_S3_BUCKET and AWS_S3_REGION must be configured");
  }

  return { bucket, region };
}

/**
 * Upload a file buffer to S3.
 * Returns the public URL of the uploaded object.
 *
 * The SDK is required lazily (at call time) so webpack does not attempt to
 * bundle @aws-sdk/client-s3 at build time. This lets the app run locally
 * without installing the SDK — the local filesystem fallback handles that case.
 */
export async function uploadImageToS3(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<UploadResult> {
  try {
    const { bucket, region } = getS3Config();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });

    const key = `uploads/${fileName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // CacheControl for images — 1 year, immutable (filename includes timestamp+uuid)
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    // Construct the public URL
    const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return { success: true, imageUrl, key };
  } catch (err) {
    const message = err instanceof Error ? err.message : "S3 upload failed";
    return { success: false, error: message };
  }
}

/**
 * Returns true if S3 is configured (env vars present).
 * Falls back to local storage when false.
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_S3_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}
