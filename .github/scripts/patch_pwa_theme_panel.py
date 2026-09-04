from pathlib import Path

path = Path("source/client/src/lib/nrd.ts")
text = path.read_text()
bridge = '''
    // O Android identifica Glass Soft como "glass". Apenas quando Glass é o tema
    // global ativo fazemos a ponte para a Home atual do PWA, evitando interferir
    // no Multicolorido quando o Mestre estiver usando outro tema.
    if (remoteTheme === "glass") {
      const glassBackgrounds = parseBackgroundEntries(backgroundMap.glass);
      if (glassBackgrounds.length) themeBackgrounds.multicolor = glassBackgrounds;
    }
'''
if bridge not in text:
    raise SystemExit("Ponte Glass→Multicolor não encontrada; revisão manual necessária.")
path.write_text(text.replace(bridge, ""))
