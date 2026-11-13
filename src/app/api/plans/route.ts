import { hqGet } from "../hq";

export async function GET() {
  const result = await hqGet("list_plans");
  return Response.json(result.body, { status: result.status });
}
