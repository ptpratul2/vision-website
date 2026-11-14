import { hqPost } from "../../hq";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await hqPost("verify_account_code", body);
  return Response.json(result.body, { status: result.status });
}
