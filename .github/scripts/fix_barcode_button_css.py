from pathlib import Path

p = Path('source/client/src/pages/ProductConsultation.css')
s = p.read_text(encoding='utf-8')
marker = '/* barcode-actions-visible-v2 */'
if marker not in s:
    s += '''\n\n/* barcode-actions-visible-v2 */\n.pc-detail-actions{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:8px!important;align-items:stretch}.pc-detail-actions>button{width:100%;min-width:0;justify-content:center}.pc-detail-actions>button:nth-child(1){grid-column:1}.pc-detail-actions>.pc-barcode-action{grid-column:2!important;display:flex!important;visibility:visible!important;opacity:1!important;background:#fff!important;color:#8c6d08!important;border:2px solid #b49116!important}.pc-detail-actions>button:nth-child(3){grid-column:1/-1;background:#2d8b49!important}@media(max-width:680px){.pc-detail-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}.pc-detail-actions>button{padding:10px 7px!important;font-size:.84rem!important;line-height:1.05}}\n'''
p.write_text(s, encoding='utf-8')
