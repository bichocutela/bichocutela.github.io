from pathlib import Path

path = Path("source/client/src/lib/nrd.ts")
text = path.read_text()
bridge = '''
    // Ponte de compatibilidade: o Android usa a chave "glass". No PWA atual o Glass
    // Soft compartilha a paleta multicolorida, então o fundo de "glass" é aplicado
    // apenas quando o tema remoto selecionado pelo Mestre também é Glass.
    const glassBackgrounds = parseBackgroundEntries(backgroundMap.glass);
    if (remoteThemeRaw === "glass" && glassBackgrounds.length) {
      themeBackgrounds.multicolor = glassBackgrounds;
    }
'''
if bridge in text:
    text = text.replace(bridge, "\n")
else:
    print("Ponte Glass→Multicolor já não existe.")
path.write_text(text)
