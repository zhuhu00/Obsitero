export async function pathExists(path: string) {
  if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
    return IOUtils.exists(path);
  }

  if (
    typeof OS !== "undefined" &&
    typeof OS.File !== "undefined" &&
    typeof OS.File.exists === "function"
  ) {
    return OS.File.exists(path);
  }

  try {
    await Zotero.File.getContentsAsync(path);
    return true;
  } catch {
    return false;
  }
}

export function joinPath(...parts: Array<string | undefined>) {
  const cleanedParts = parts.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  if (typeof PathUtils !== "undefined" && typeof PathUtils.join === "function") {
    return PathUtils.join(...cleanedParts);
  }

  if (
    typeof OS !== "undefined" &&
    typeof OS.Path !== "undefined" &&
    typeof OS.Path.join === "function"
  ) {
    return OS.Path.join(...cleanedParts);
  }

  return cleanedParts
    .map((part, index) =>
      index === 0 ? part.replace(/[\\/]+$/, "") : part.replace(/^[\\/]+|[\\/]+$/g, ""),
    )
    .join("/");
}

export async function readTextIfExists(path: string) {
  if (!(await pathExists(path))) {
    return undefined;
  }

  const contents = await Zotero.File.getContentsAsync(path);
  return typeof contents === "string" ? contents : undefined;
}
