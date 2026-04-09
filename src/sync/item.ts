import type { SyncChildNote, SyncItemData } from "./markdown";
import { buildCollectionFullName } from "./collections";
import { resolveItemUrl } from "./item-url";

export async function buildSyncItemData(
  item: Zotero.Item,
): Promise<SyncItemData> {
  return {
    itemKey: item.key,
    title: item.getField("title") || item.getDisplayTitle(),
    authors: getAuthorNames(item),
    authorsShort: getAuthorNames(item).slice(0, 2),
    year: getItemYear(item),
    publication: getPublicationTitle(item),
    tags: getControlledTags(item),
    collections: item
      .getCollections()
      .map((collectionID) => Zotero.Collections.get(collectionID))
      .filter(Boolean)
      .map((collection) => buildCollectionFullName(collection)),
    citationKey: getCitationKey(item),
    zoteroUri: Zotero.URI.getItemURI(item),
    doi: item.getField("DOI") || item.getField("doi"),
    url: item.getField("url"),
    link: resolveItemUrl(item),
    dateAdded: item.dateAdded,
    dateModified: item.dateModified,
    childNotes: await getChildNotes(item),
  };
}

function getAuthorNames(item: Zotero.Item) {
  return item
    .getCreators()
    .map((creator) => formatCreatorName(creator))
    .filter(Boolean);
}

function getControlledTags(item: Zotero.Item): string[] {
  const tags = item
    .getTags()
    .map((tag) => tag.tag?.trim().toLowerCase())
    .filter((tag): tag is string => Boolean(tag));

  if (tags.includes("/done")) {
    return ["Done"];
  }
  if (tags.includes("/reading")) {
    return ["Reading"];
  }
  if (tags.includes("/unread")) {
    return ["Unread"];
  }
  return [];
}

async function getChildNotes(item: Zotero.Item): Promise<SyncChildNote[]> {
  const noteIDs = item.getNotes();
  if (!noteIDs.length) {
    return [];
  }

  const notes = Zotero.Items.get(noteIDs).filter((note): note is Zotero.Item =>
    Boolean(note),
  );
  if (!notes.length) {
    return [];
  }

  await Zotero.Items.loadDataTypes(notes, ["note"]);
  return notes
    .filter((note) => note.isNote() && !note.deleted)
    .map((note) => ({
      title: note.getNoteTitle()?.trim(),
      body: normalizeNoteContent(note.getNote()),
    }))
    .filter((note) => note.body);
}

function normalizeNoteContent(noteHtml: string) {
  return decodeHtmlEntities(
    noteHtml
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function formatCreatorName(creator: _ZoteroTypes.Item.Creator) {
  const singleFieldName = (
    creator as _ZoteroTypes.Item.Creator & { name?: string }
  ).name;
  if (singleFieldName) {
    return singleFieldName.trim();
  }

  return [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
}

function getItemYear(item: Zotero.Item) {
  const explicitYear = item.getField("year");
  if (explicitYear) {
    return explicitYear;
  }

  const dateField = item.getField("date");
  const match = dateField?.match(/\b\d{4}\b/);
  return match?.[0] || "";
}

function getPublicationTitle(item: Zotero.Item) {
  const candidates = [
    "publicationTitle",
    "proceedingsTitle",
    "bookTitle",
    "encyclopediaTitle",
    "dictionaryTitle",
    "forumTitle",
    "websiteTitle",
  ];

  for (const field of candidates) {
    const value = item.getField(field);
    if (value) {
      return value;
    }
  }

  return "";
}

function getCitationKey(item: Zotero.Item) {
  const directCitationKey = item.getField("citationKey");
  if (directCitationKey) {
    return directCitationKey;
  }

  const extra = item.getField("extra");
  const match = extra?.match(/^(?:Citation Key|Citation key):\s*(.+)$/im);
  return match?.[1]?.trim() || "";
}
