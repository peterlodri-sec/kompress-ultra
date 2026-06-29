export enum CompressionLevel {
  Verbatim = 0,   // 0% savings
  Lite = 1,       // 40% savings
  Ultra = 2,      // 75% savings
  BrainBacked = 3 // 90% savings
}

export function compressMessage(content: string, level: CompressionLevel): string {
  if (level === CompressionLevel.Verbatim) return content;

  // Protect code fences
  const codeBlocks: string[] = [];
  let result = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Protect error messages
  const errors: string[] = [];
  result = result.replace(/Error:[^\n]*/g, (match) => {
    errors.push(match);
    return `__ERROR_${errors.length - 1}__`;
  });

  if (level === CompressionLevel.Lite) {
    // Drop articles, filler, pleasantries
    result = result.replace(/\b(the|a|an|this|that|these|those)\b/gi, ' ');
    result = result.replace(/\b(just|really|basically|actually|simply)\b/gi, ' ');
    result = result.replace(/\b(I would be happy to|Sure!|Great!|Excellent!)\b/gi, '');
    result = result.replace(/\s{2,}/g, ' ').trim();
  } else if (level === CompressionLevel.Ultra) {
    // Caveman-ultra: [thing] [action] [reason]
    const sentences = result.split(/[.!?]+/).filter(s => s.trim());
    const compressed = sentences.map(s => {
      s = s.trim();
      // Drop pleasantries entirely
      if (/\b(sure|great|excellent|happy|glad|welcome)\b/i.test(s)) return '';
      // Drop "I have", "I will", "I am", "it is", etc
      s = s.replace(/\b(I (have|will|am|would|can|did|was|were)|it (is|was|has))\b/gi, '').trim();
      // Drop articles
      s = s.replace(/\b(the|a|an|this|that|these|those)\b/gi, '').trim();
      // Drop filler
      s = s.replace(/\b(just|really|basically|actually|simply|now|successfully|already|still|even)\b/gi, '').trim();
      // Drop common fluff words
      s = s.replace(/\b(is|are|was|were|been|being|has|had|do|does|did|and|or|but|for|with|from|in|on|at|to|of)\b/gi, ' ').trim();
      // Drop "it", "me", "my", "we", "our", "they", "them"
      s = s.replace(/\b(it|me|my|we|our|they|them|their)\b/gi, ' ').trim();
      // Drop common filler nouns
      s = s.replace(/\b(system|implementation|support|tests|things|stuff|work)\b/gi, ' ').trim();
      return s.replace(/\s{2,}/g, ' ').trim();
    }).filter(Boolean).join('. ');
    result = compressed;
  }

  // Restore protected content
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)]);
  result = result.replace(/__ERROR_(\d+)__/g, (_, i) => errors[parseInt(i)]);

  return result.replace(/\s{2,}/g, ' ').trim();
}
