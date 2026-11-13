import { hqGet } from "../hq";

export async function GET(request: Request) {
  const companyCode = new URL(request.url).searchParams.get("company_code") || "";
  const result = await hqGet(`registration_status?company_code=${encodeURIComponent(companyCode)}`);
  return Response.json(result.body, { status: result.status });
}
