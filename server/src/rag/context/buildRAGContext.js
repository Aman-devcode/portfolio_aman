function publicMetadata(result) { return { type: result.type, title: result.title, slug: result.slug, source: result.source || 'portfolio' }; }
export function buildRAGContext(results, { maxCharacters = 6500, similarityThreshold = 0.42 } = {}) {
  if (!Array.isArray(results) || !Number.isInteger(maxCharacters) || maxCharacters < 1) throw new Error('Invalid retrieved context.');
  const seen = new Set(); const selected = []; let used = 0;
  for (const result of results) {
    if (!result || typeof result.content !== 'string' || !result.content.trim() || !Number.isFinite(result.score) || result.score < similarityThreshold) continue;
    const normalized = result.content.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(normalized)) continue;
    const metadata = publicMetadata(result);
    if (![metadata.type, metadata.title, metadata.slug].every(value => typeof value === 'string' && value.length <= 160)) continue;
    const entry = `[Source: ${metadata.type} | ${metadata.title} | slug: ${metadata.slug}]\n${result.content.trim()}`;
    if (used + entry.length > maxCharacters) continue;
    seen.add(normalized); selected.push({ ...metadata, score: result.score, content: result.content.trim() }); used += entry.length;
  }
  const context = selected.map(item => `[Source: ${item.type} | ${item.title} | slug: ${item.slug}]\n${item.content}`).join('\n\n');
  return { context, sources: selected.map(({ type, title, slug, source }) => ({ type, title, slug, source })), results: selected };
}
