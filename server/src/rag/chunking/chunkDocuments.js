const sentences = text => text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(value => value.trim()).filter(Boolean) || [];

function splitLongSentence(sentence, limit, overlap) {
  const output = [];
  let start = 0;
  while (sentence.length - start > limit) {
    let end = Math.min(start + limit, sentence.length);
    const boundary = sentence.lastIndexOf(' ', end);
    if (boundary > start + Math.floor(limit * 0.6)) end = boundary;
    const text = sentence.slice(start, end).trim();
    if (text) output.push(text);
    const nextStart = Math.max(start + 1, end - overlap);
    start = nextStart;
    while (sentence[start] === ' ') start++;
  }
  const tail = sentence.slice(start).trim();
  if (tail) output.push(tail);
  return output;
}

export function chunkDocuments(documents, { maxCharacters = 850, overlapCharacters = 100 } = {}) {
  if (!Array.isArray(documents) || !Number.isInteger(maxCharacters) || maxCharacters < 180 || !Number.isInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maxCharacters) throw new Error('Invalid chunking input or limits.');
  const chunks = [];
  for (const doc of documents) {
    if (!doc || typeof doc.id !== 'string' || typeof doc.content !== 'string' || !doc.content.trim() || !doc.metadata) throw new Error('Malformed document supplied to chunker.');
    let current = ''; let index = 0;
    const emit = () => {
      const content = current.trim();
      if (content) chunks.push({ id: `${doc.id}:chunk:${String(++index).padStart(3, '0')}`, documentId: doc.id, type: doc.type, title: doc.title, source: doc.source, slug: doc.metadata.slug, category: doc.metadata.category, content });
    };

    for (const sentence of sentences(doc.content)) {
      if (sentence.length > maxCharacters) {
        if (current) emit();
        current = '';
        const parts = splitLongSentence(sentence, maxCharacters, overlapCharacters);
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
          current = parts[partIndex];
          emit();
          current = '';
        }
        continue;
      }

      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > maxCharacters && current) {
        const previous = current;
        emit();
        const overlap = previous.slice(-Math.min(overlapCharacters, Math.max(0, maxCharacters - sentence.length - 1))).trim();
        current = overlap ? `${overlap} ${sentence}` : sentence;
      } else current = next;
    }
    emit();
  }
  return chunks;
}
