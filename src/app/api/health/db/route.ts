import sql from "@/lib/db";

export async function GET() {
  const result = await sql`SELECT 1 as ok`;
  return Response.json(result[0]);
}
