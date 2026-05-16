import z from "zod";

export function booleanFromString(str: string | undefined, fallback = false) {
  if (str === "true") return true;
  if (str === "false") return false;
  return fallback;
}
// ─── Zod Schema ───────────────────────────────────────────────────

export const CodeSchema = z.object({
  system: z.string().min(1, "Code system is required"),
  code: z.string().min(1, "Code value is required"),
  display: z.string().min(1, "Code display is required"),
});
