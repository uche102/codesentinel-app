export function parseJsonResponseBody(rawText, response) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isLikelyJson =
    contentType.includes("application/json") ||
    text.startsWith("{") ||
    text.startsWith("[");

  if (!isLikelyJson) {
    const preview = text.replace(/\s+/g, " ").slice(0, 180);
    const reason = contentType.includes("text/html")
      ? "The GitHub inspection endpoint returned an HTML error page."
      : "GitHub returned a non-JSON response.";

    throw new Error(
      `${reason} ${preview ? `Response preview: ${preview}` : "Check that the repository URL is valid and GitHub is reachable."}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      "GitHub inspection returned invalid JSON. Check that the repository URL is valid and GitHub is reachable.",
    );
  }
}

export async function readJsonResponse(response) {
  const rawText = await response.text();
  return parseJsonResponseBody(rawText, response);
}
