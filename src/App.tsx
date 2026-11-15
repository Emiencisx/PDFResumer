import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Upload, BookOpen, Moon, Sun, Shield, Github, ArrowRight } from 'lucide-react';
import { extractTextFromPDF } from './utils/textExtractor';
import { generateLocalSummary, SummaryResult } from './utils/summarizer';
import { saveDocumentToHistory, getHistory, deleteHistoryItem, HistoryItem } from './utils/db';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentDoc, setCurrentDoc] = useState<{ title: string; pageCount: number; summary: SummaryResult } | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'study' | 'history'>('summary');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summaryMode, setSummaryMode] = useState<'brief' | 'comprehensive' | 'academic' | 'simple'>('brief');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    loadHistory();
  }, [darkMode]);

  const loadHistory = async () => {
    try { setHistory(await getHistory()); } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') return alert('Por favor selecciona un archivo PDF válido.');
    setLoading(true);
    setLoadingProgress(30);
    try {
      const extracted = await extractTextFromPDF(file);
      setLoadingProgress(75);
      const summary = generateLocalSummary(extracted.text, extracted.title);
      const docData = { title: extracted.title, pageCount: extracted.pageCount, summary };
      setCurrentDoc(docData);
      await saveDocumentToHistory({
        id: Date.now().toString(),
        title: extracted.title,
        date: new Date().toLocaleDateString(),
        pageCount: extracted.pageCount,
        data: docData
      });
      await loadHistory();
      setLoadingProgress(100);
    } catch (error) {
      alert('Hubo un error al procesar el archivo PDF.');
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-main)] flex flex-col">
      <header className="sticky top-0 z-50 glass-panel border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentDoc(null)}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight">LUMI AI</h1>
            <p className="text-xs text-[var(--text-muted)]">Intelligent PDF Summarizer</p>
          </div>
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-full hover:bg-[var(--bg-tertiary)] border border-[var(--border)]">
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col">
        {!currentDoc && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center my-auto py-12 animate-fade-in">
            <div className="text-center max-w-xl mb-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 mb-4 border border-blue-500/20">
                <Shield className="w-3.5 h-3.5" /> 100% Local & Privado
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Convertí documentos largos en conocimiento.</h2>
              <p className="text-[var(--text-muted)] text-base sm:text-lg">Sube cualquier PDF y obtén resúmenes inteligentes, puntos clave y herramientas de estudio instantáneas.</p>
            </div>

            <label className="w-full max-w-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all bg-[var(--bg-secondary)] shadow-lg group">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <p className="font-semibold text-lg mb-1">Arrastra tu archivo PDF aquí</p>
              <p className="text-sm text-[var(--text-muted)] mb-4">o haz clic para explorar tus archivos</p>
              <span className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium shadow-md">Seleccionar PDF</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            </label>

            {history.length > 0 && (
              <div className="w-full max-w-xl mt-12">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Documentos Recientes</h3>
                <div className="space-y-2">
                  {history.slice(0, 3).map((item) => (
                    <div key={item.id} onClick={() => setCurrentDoc(item.data)} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] cursor-pointer flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[var(--accent)]" />
                        <div>
                          <p className="font-medium text-sm truncate max-w-xs">{item.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.pageCount} páginas • {item.date}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center my-auto py-20 animate-fade-in">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin mb-6"></div>
            <h3 className="text-xl font-semibold mb-2">Procesando documento... ({loadingProgress}%)</h3>
          </div>
        )}

        {currentDoc && !loading && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-6">
              <div>
                <button onClick={() => setCurrentDoc(null)} className="text-xs text-[var(--accent)] font-medium mb-1 hover:underline">← Volver al inicio</button>
                <h2 className="text-2xl font-bold">{currentDoc.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">{currentDoc.pageCount} páginas analizadas</p>
              </div>
              <div className="flex items-center bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border)]">
                {(['summary', 'study', 'history'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-medium capitalize ${activeTab === tab ? 'bg-[var(--bg-secondary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                    {tab === 'summary' ? 'Resumen' : tab === 'study' ? 'Estudio' : 'Historial'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  {[
                    { id: 'brief', label: 'Resumen Breve' },
                    { id: 'comprehensive', label: 'Resumen Completo' },
                    { id: 'academic', label: 'Enfoque Académico' },
                    { id: 'simple', label: 'Explicación Sencilla' }
                  ].map((mode) => (
                    <button key={mode.id} onClick={() => setSummaryMode(mode.id as any)} className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium border ${summaryMode === mode.id ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-[var(--bg-secondary)] border-[var(--border)]'}`}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="lg:col-span-3 space-y-6">
                  <div className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-[var(--accent)]" /> Resultado</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{currentDoc.summary[summaryMode]}</p>
                  </div>
                  <div className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                    <h3 className="text-lg font-semibold mb-4">Puntos Clave</h3>
                    <ul className="space-y-3">
                      {currentDoc.summary.keyPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'study' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-purple-500" /> Flashcards</h3>
                  <div className="space-y-4">
                    {currentDoc.summary.flashcards.map((fc, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                        <p className="text-xs font-bold text-[var(--accent)] mb-1">{fc.front}</p>
                        <p className="text-sm">{fc.back}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <h3 className="text-lg font-semibold mb-4">Preguntas de Examen</h3>
                  <div className="space-y-4">
                    {currentDoc.summary.questions.map((q, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                        <p className="text-sm font-semibold mb-2">Q{i + 1}: {q.question}</p>
                        <p className="text-xs text-[var(--text-muted)]">R: {q.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentDoc(item.data); setActiveTab('summary'); }}>
                      <FileText className="w-5 h-5 text-[var(--accent)]" />
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.pageCount} páginas • {item.date}</p>
                      </div>
                    </div>
                    <button onClick={async () => { await deleteHistoryItem(item.id); loadHistory(); }} className="text-xs text-rose-500 hover:underline">Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
