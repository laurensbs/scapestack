export type CopyTextResult = "clipboard" | "fallback" | "failed";

export async function copyText(value: string): Promise<CopyTextResult> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return "clipboard";
    } catch {
      // Continue to DOM fallback below. Browser clipboard permissions are
      // fragile in embedded browsers and localhost test harnesses.
    }
  }

  if (typeof document === "undefined") return "failed";

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand?.("copy") === true;
    return ok ? "fallback" : "failed";
  } catch {
    return "failed";
  } finally {
    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) selection.addRange(previousRange);
    }
  }
}
