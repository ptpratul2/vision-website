const HQ = "https://cnd.octavision.in/api/method/octavision_hq.registration.";

function readError(data: { message?: string; _server_messages?: string; exception?: string }) {
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages);
      const first = JSON.parse(messages[0]);
      if (first?.message) return String(first.message);
    } catch {
      return "Something went wrong. Try again.";
    }
  }
  if (typeof data.message === "string" && data.message) return data.message;
  return "Something went wrong. Try again.";
}

async function callHq(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok || data.exc || data.exception) {
    return { status: response.status || 400, body: { error: readError(data) } };
  }
  return { status: 200, body: data.message };
}

export function hqGet(methodAndQuery: string) {
  return callHq(`${HQ}${methodAndQuery}`);
}

export function hqPost(method: string, body: unknown) {
  return callHq(`${HQ}${method}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
