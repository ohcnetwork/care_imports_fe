export async function createSlug(
  name: string,
  maxLength = 25,
  disablePadding = false,
) {
  if (!name) {
    return "";
  }

  let slug = name.toLowerCase();
  slug = slug.replace(/[^a-z0-9\s_-]/g, "");
  slug = slug.replace(/\s+/g, "-");
  slug = slug.replace(/-+/g, "-");
  slug = slug.trim();
  slug = slug.slice(0, maxLength);

  if (slug.length < maxLength && !disablePadding) {
    const encoder = new TextEncoder();
    const data = encoder.encode(slug);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const neededHash = maxLength - slug.length - 1;
    if (neededHash > 0) {
      slug = `${slug}-${hashHex.slice(0, neededHash)}`;
    }
  }

  return slug;
}
