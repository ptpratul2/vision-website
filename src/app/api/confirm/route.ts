import { hqPost } from "../hq";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await hqPost("confirm_payment", body);
  return Response.json(result.body, { status: result.status });
}
