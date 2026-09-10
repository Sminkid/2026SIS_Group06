const namedEntities: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
};

export const readableText = (value: string): string => value
  .replace(/<(?:br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key[0] !== "#") return namedEntities[key.toLowerCase()] ?? entity;
    const hexadecimal = key[1]?.toLowerCase() === "x";
    const point = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
  })
  .replace(/\s+/g, " ")
  .trim();
