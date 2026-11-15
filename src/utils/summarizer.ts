export interface SummaryResult {
  brief: string;
  comprehensive: string;
  academic: string;
  keyPoints: string[];
  simple: string;
  questions: { question: string; answer: string }[];
  flashcards: { front: string; back: string }[];
}

export function generateLocalSummary(fullText: string, title: string): SummaryResult {
  const sentences = fullText
    .replace(/\[Página \d+\]/g, '')
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const uniqueSentences = Array.from(new Set(sentences));
  const total = uniqueSentences.length;

  const briefSentences = uniqueSentences.slice(0, Math.max(2, Math.min(4, Math.floor(total * 0.1)))).join('. ') + '.';
  const compSentences = uniqueSentences.slice(0, Math.max(5, Math.min(10, Math.floor(total * 0.3)))).join('. ') + '.';
  const keyPoints = uniqueSentences.slice(0, 6).map(s => s.length > 100 ? s.substring(0, 97) + '...' : s);

  const questions = uniqueSentences.slice(0, 5).map((s, idx) => ({
    question: `¿Qué aspecto importante se menciona sobre el concepto central ${idx + 1}?`,
    answer: s.substring(0, 120) + '...'
  }));

  const flashcards = uniqueSentences.slice(0, 5).map((s, idx) => ({
    front: `Concepto Clave #${idx + 1}`,
    back: s.substring(0, 140)
  }));

  return {
    brief: briefSentences || "El documento analizado contiene información general sobre la materia estudiada.",
    comprehensive: compSentences || fullText.substring(0, 1000),
    academic: `Análisis Académico de ${title}:\n\n${compSentences}`,
    keyPoints,
    simple: `En términos sencillos, este documento trata sobre: ${briefSentences}`,
    questions,
    flashcards
  };
}
