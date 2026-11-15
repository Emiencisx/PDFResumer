import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedPDFData {
  title: string;
  pageCount: number;
  text: string;
}

export async function extractTextFromPDF(file: File): Promise<ExtractedPDFData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdfDocument.numPages;
  let fullText = '';

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `\n[Página ${i}]\n` + pageText;
  }

  return { title: file.name.replace(/\.[^/.]+$/, ''), pageCount, text: fullText };
}
