import nodemailer from "nodemailer";
import { hqPost } from "../../hq";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = await hqPost("issue_account_code", body, {
    "X-Account-Proxy": process.env.ACCOUNT_PROXY_SECRET || "",
  });
  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }
  if (result.body?.already_sent) {
    return Response.json({ sent: true, already_sent: true });
  }
  const code = String(result.body?.code || "");
  const clientName = String(result.body?.client_name || "your company").trim() || "your company";
  if (!code || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    await hqPost("clear_account_code", body, {
      "X-Account-Proxy": process.env.ACCOUNT_PROXY_SECRET || "",
    });
    return Response.json({ error: "The sign-in code could not be sent." }, { status: 500 });
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    const safeName = escapeHtml(clientName);
    const safeCode = escapeHtml(code);
    await transporter.sendMail({
      from: `"Vision" <${process.env.EMAIL_USER}>`,
      to: String(body.email || ""),
      subject: `Sign-in code for ${clientName}`,
      text: [
        `Dear ${clientName} team,`,
        "",
        "Thank you for using Vision.",
        "",
        `Please use the code below to open the ${clientName} account. You can review the current plan or choose a different one. The company code will remain the same.`,
        "",
        code,
        "",
        "This code is valid for 10 minutes. If you did not request it, you may ignore this email.",
        "",
        "Regards,",
        "Vision",
        "Octavision",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <p>Dear ${safeName} team,</p>
          <p>Thank you for using Vision.</p>
          <p>Please use the code below to open the <strong>${safeName}</strong> account. You can review the current plan or choose a different one. The company code will remain the same.</p>
          <p style="margin: 24px 0; font-size: 28px; letter-spacing: 6px; font-weight: 700;">${safeCode}</p>
          <p>This code is valid for 10 minutes. If you did not request it, you may ignore this email.</p>
          <p>Regards,<br>Vision<br>Octavision</p>
        </div>
      `,
    });
  } catch {
    await hqPost("clear_account_code", body, {
      "X-Account-Proxy": process.env.ACCOUNT_PROXY_SECRET || "",
    });
    return Response.json({ error: "The sign-in code could not be sent." }, { status: 500 });
  }
  return Response.json({ sent: true });
}
