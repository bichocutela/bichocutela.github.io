from pathlib import Path

path = Path(".github/scripts/patch_pwa_admin_products.py")
text = path.read_text()

replacements = {
    "return [...groups.entries()];": "return Array.from(groups.entries());",
    "new Set([...current].filter((item) => available.has(item)))": "new Set(Array.from(current).filter((item) => available.has(item)))",
    "{groupProducts.map(item=><article": "{groupProducts.map((item: ManagedProduct)=><article",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Trecho esperado não encontrado: {old}")
    text = text.replace(old, new, 1)

path.write_text(text)
