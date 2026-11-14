import nodemailer from "nodemailer";
import { hqPost } from "../../hq";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await hqPost("issue_account_code", body, {
    "X-Account-Proxy": process.env.ACCOUNT_PROXY_SECRET || "",
  });
  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }
  const code = String(result.body?.code || "");
  const clientName = String(result.body?.client_name || "your company");
  if (!code || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return Response.json({ error: "The sign-in code could not be sent." }, { status: 500 });
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Vision" <${process.env.EMAIL_USER}>`,
      to: String(body.email || ""),
      subject: "Your Vision account code",
      text: [
        `Use this code to open the ${clientName} account: ${code}`,
        "It expires in 10 minutes.",
        "If you did not ask for this, ignore the email.",
      ].join("\n"),
    });
  } catch {
    return Response.json({ error: "The sign-in code could not be sent." }, { status: 500 });
  }
  return Response.json({ sent: true });
}
