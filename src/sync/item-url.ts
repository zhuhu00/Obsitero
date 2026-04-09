export function resolveItemUrl(item: Pick<Zotero.Item, "getField">) {
  const explicitUrl = item.getField("url");
  if (explicitUrl) {
    return explicitUrl;
  }

  const doi = item.getField("DOI") || item.getField("doi");
  const arxivFromDoi = extractArxivId(doi);
  if (arxivFromDoi) {
    return `https://arxiv.org/abs/${arxivFromDoi}`;
  }

  const archive = item.getField("archive");
  const archiveLocation = item.getField("archiveLocation");
  if (archive?.toLowerCase() === "arxiv" && archiveLocation) {
    return `https://arxiv.org/abs/${archiveLocation.trim()}`;
  }

  const extra = item.getField("extra");
  const arxivFromExtra = extra?.match(/(?:^|\n)arXiv:\s*([^\s]+)/i)?.[1]?.trim();
  if (arxivFromExtra) {
    return `https://arxiv.org/abs/${arxivFromExtra}`;
  }

  return "";
}

function extractArxivId(doi?: string) {
  const match = doi?.match(/^10\.48550\/arXiv\.(.+)$/i);
  return match?.[1]?.trim() || "";
}
