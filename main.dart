import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

// Modelos: cámbialos aquí si quieres otros.
const kModelFinal = 'claude-sonnet-5-5';
const kModelChunks = 'claude-haiku-5-5';

void main() => runApp(const App());

class App extends StatelessWidget {
  const App({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Resumidor PDF',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFFC15F3C), useMaterial3: true),
        darkTheme: ThemeData(
            colorSchemeSeed: const Color(0xFFC15F3C),
            brightness: Brightness.dark,
            useMaterial3: true),
        home: const Home(),
      );
}

Map<String, dynamic> _extract(Uint8List bytes) {
  final d = PdfDocument(inputBytes: bytes);
  final pages = d.pages.count;
  final t = PdfTextExtractor(d).extractText().replaceAll(RegExp(r'\s+'), ' ').trim();
  d.dispose();
  return {'pages': pages, 'text': t};
}

List<String> _chunk(String text, int size) {
  final out = <String>[];
  var i = 0;
  while (i < text.length) {
    var end = min(i + size, text.length);
    if (end < text.length) {
      final b = text.lastIndexOf('. ', end);
      if (b > i + size * 0.6) end = b + 1;
    }
    out.add(text.substring(i, end));
    i = end;
  }
  return out;
}

Future<String> _ask(String key, String model, String prompt, {int maxTokens = 2500}) async {
  final r = await http.post(
    Uri.parse('https://api.anthropic.com/v1/messages'),
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: jsonEncode({
      'model': model,
      'max_tokens': maxTokens,
      'messages': [
        {'role': 'user', 'content': prompt}
      ],
    }),
  );
  final body = utf8.decode(r.bodyBytes);
  if (r.statusCode != 200) {
    var msg = body;
    try {
      msg = jsonDecode(body)['error']['message'];
    } catch (_) {}
    throw Exception('API ${r.statusCode}: $msg');
  }
  final data = jsonDecode(body);
  return (data['content'] as List)
      .where((b) => b['type'] == 'text')
      .map((b) => b['text'])
      .join('\n');
}

class Home extends StatefulWidget {
  const Home({super.key});
  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  static const _lens = {
    'corto': 'unas 150 palabras: idea central y 3-5 viñetas',
    'medio': 'unas 400 palabras: resumen general, puntos clave en viñetas y conclusiones',
    'detallado':
        'unas 900 palabras, con secciones tituladas por tema, datos y cifras importantes y conclusiones',
  };
  static const _langs = ['español', 'English', 'português', 'français'];

  String? _key, _name, _text;
  int _pages = 0;
  String _len = 'medio', _lang = 'español', _status = '', _summary = '';
  double? _progress;
  bool _busy = false, _cancel = false;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) => setState(() => _key = p.getString('apiKey')));
  }

  Future<void> _settings() async {
    final c = TextEditingController(text: _key ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Clave de la API de Anthropic'),
        content: TextField(
          controller: c,
          obscureText: true,
          decoration: const InputDecoration(hintText: 'sk-ant-...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Guardar')),
        ],
      ),
    );
    if (ok == true) {
      final p = await SharedPreferences.getInstance();
      await p.setString('apiKey', c.text.trim());
      setState(() => _key = c.text.trim());
    }
  }

  Future<void> _pick() async {
    final r = await FilePicker.platform
        .pickFiles(type: FileType.custom, allowedExtensions: ['pdf'], withData: true);
    if (r == null || r.files.single.bytes == null) return;
    final f = r.files.single;
    setState(() {
      _status = 'Leyendo el PDF…';
      _summary = '';
      _text = null;
      _name = f.name;
    });
    try {
      final res = await compute(_extract, f.bytes!);
      final t = res['text'] as String;
      if (t.length < 200) {
        setState(() => _status =
            'Casi no hay texto: puede ser un PDF escaneado (hace falta OCR).');
        return;
      }
      setState(() {
        _text = t;
        _pages = res['pages'] as int;
        _status = '';
      });
    } catch (e) {
      setState(() => _status = 'No pude leer el PDF: $e');
    }
  }

  Future<void> _run() async {
    if (_key == null || _key!.isEmpty) {
      await _settings();
      if (_key == null || _key!.isEmpty) return;
    }
    setState(() {
      _busy = true;
      _cancel = false;
      _summary = '';
      _progress = 0;
    });
    try {
      final parts = _chunk(_text!, max(14000, (_text!.length / 40).ceil()));
      String material;
      if (parts.length > 1) {
        final notes = <String>[];
        for (var i = 0; i < parts.length; i++) {
          if (_cancel) throw Exception('Cancelado');
          setState(() {
            _status = 'Resumiendo parte ${i + 1} de ${parts.length}…';
            _progress = i / parts.length;
          });
          notes.add(await _ask(
              _key!,
              kModelChunks,
              'Resume fielmente esta parte (${i + 1}/${parts.length}) de un documento largo en $_lang. '
              'Conserva datos, cifras, nombres y argumentos clave; sin introducción.\n\n${parts[i]}',
              maxTokens: 1200));
        }
        material = 'Notas por secciones del documento:\n\n' +
            [for (var i = 0; i < notes.length; i++) '[${i + 1}] ${notes[i]}'].join('\n\n');
      } else {
        material = parts.first;
      }
      if (_cancel) throw Exception('Cancelado');
      setState(() {
        _status = 'Redactando el resumen final…';
        _progress = null;
      });
      final s = await _ask(
          _key!,
          kModelFinal,
          'Escribe en $_lang un resumen de ${_lens[_len]}. Usa texto plano (sin Markdown): '
          'títulos en su propia línea y viñetas con "•". No inventes nada que no esté en el material.\n\n'
          'Archivo: $_name\n\n$material');
      setState(() {
        _summary = s.trim();
        _status = 'Listo.';
      });
    } catch (e) {
      setState(() => _status = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() {
        _busy = false;
        _progress = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resumidor PDF'),
        actions: [IconButton(icon: const Icon(Icons.key), tooltip: 'Clave API', onPressed: _settings)],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: ListView(padding: const EdgeInsets.all(20), children: [
              FilledButton.tonalIcon(
                onPressed: _busy ? null : _pick,
                icon: const Icon(Icons.picture_as_pdf),
                label: const Text('Elegir PDF'),
              ),
              if (_text != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text('$_name · $_pages páginas · ${_text!.length} caracteres',
                      style: TextStyle(color: cs.onSurfaceVariant)),
                ),
              const SizedBox(height: 16),
              Wrap(spacing: 12, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.center, children: [
                DropdownButton<String>(
                  value: _len,
                  items: _lens.keys.map((k) => DropdownMenuItem(value: k, child: Text(k))).toList(),
                  onChanged: _busy ? null : (v) => setState(() => _len = v!),
                ),
                DropdownButton<String>(
                  value: _lang,
                  items: _langs.map((k) => DropdownMenuItem(value: k, child: Text(k))).toList(),
                  onChanged: _busy ? null : (v) => setState(() => _lang = v!),
                ),
                FilledButton(
                    onPressed: (_text == null || _busy) ? null : _run, child: const Text('Resumir')),
                if (_busy)
                  OutlinedButton(onPressed: () => _cancel = true, child: const Text('Cancelar')),
              ]),
              const SizedBox(height: 16),
              if (_busy) LinearProgressIndicator(value: _progress),
              if (_status.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(_status, style: TextStyle(color: cs.onSurfaceVariant)),
                ),
              if (_summary.isNotEmpty) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: SelectableText(_summary, style: const TextStyle(height: 1.5, fontSize: 16)),
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.copy),
                    label: const Text('Copiar'),
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: _summary));
                      if (mounted) setState(() => _status = 'Copiado.');
                    },
                  ),
                ),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
