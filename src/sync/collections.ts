export function getAllCollections(): Zotero.Collection[] {
  return Zotero.Libraries.getAll()
    .filter((library) => library.libraryType !== "feed")
    .flatMap((library) =>
      Zotero.Collections.getByLibrary(library.libraryID, true),
    )
    .sort((left, right) =>
      buildCollectionFullName(left).localeCompare(
        buildCollectionFullName(right),
      ),
    );
}

export function getAllCollectionItems(
  collection: Zotero.Collection,
): Zotero.Item[] {
  const items = [...collection.getChildItems(false, false)];

  for (const childCollection of collection.getChildCollections(false, false)) {
    items.push(...getAllCollectionItems(childCollection));
  }

  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function buildCollectionFullName(collection: Zotero.Collection): string {
  const parent =
    collection.parentID && Zotero.Collections.get(collection.parentID);

  if (!parent) {
    return collection.name;
  }

  return `${buildCollectionFullName(parent)} ▸ ${collection.name}`;
}
