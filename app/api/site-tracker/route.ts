import { apiError } from "@/lib/site-db";
import { trackerHunts } from "@/lib/site-tracker";
export async function GET() {
  try {
    return Response.json({ hunts: await trackerHunts() });
  } catch (e) {
    return apiError(e);
  }
}
