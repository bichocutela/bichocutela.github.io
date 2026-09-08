from pathlib import Path

management = Path('source/client/src/lib/managementData.ts')
panel = Path('source/client/src/components/ManagementPanel.tsx')

text = management.read_text(encoding='utf-8')
text = text.replace('import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";\n', '')
text = text.replace('import { nrdAuth, nrdDb, nrdStorage } from "@/lib/firebase";', 'import { nrdAuth, nrdDb } from "@/lib/firebase";')

old = '''export async function uploadManagementImage(file: File, folder: string) {\n  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");\n  const target = storageRef(nrdStorage, `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`);\n  await uploadBytes(target, file, { contentType: file.type || undefined });\n  return getDownloadURL(target);\n}\n'''

new = '''const PWA_SUPABASE_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL || "https://kkayksyzksexoarpfxyj.supabase.co").replace(/\\/$/, "");\nconst PWA_SUPABASE_ANON_KEY = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY || "";\nconst MAX_UPLOAD_BYTES = 80 * 1024 * 1024;\n\nexport async function uploadManagementImage(file: File, folder: string) {\n  if (!file || file.size <= 0) throw new Error("O arquivo selecionado está vazio ou não pôde ser lido.");\n  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Arquivo maior que 80 MB.");\n  if (!file.type.startsWith("image/")) throw new Error("Formato não suportado. Selecione uma imagem JPG, PNG ou WEBP.");\n  const user = nrdAuth.currentUser;\n  if (!user) throw new Error("Sessão do Mestre expirada. Entre novamente.");\n  if (!PWA_SUPABASE_ANON_KEY) throw new Error("Upload remoto do PWA não está configurado com a chave pública do Supabase.");\n\n  const token = await user.getIdToken(false);\n  const extensionFromName = file.name.split('.').pop()?.toLowerCase();\n  const extension = extensionFromName && /^[a-z0-9]{1,8}$/.test(extensionFromName)\n    ? extensionFromName\n    : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';\n  const cleanFolder = folder.replace(/[^a-zA-Z0-9/_-]+/g, '-').replace(/^\\/+|\\/+$/g, '');\n  const remotePath = `dynamic-pages/pwa/${cleanFolder}/${Date.now()}_${crypto.randomUUID()}.${extension}`;\n  const formData = new FormData();\n  formData.append('path', remotePath);\n  formData.append('file', file, file.name || `upload.${extension}`);\n\n  const controller = new AbortController();\n  const timeout = window.setTimeout(() => controller.abort(), 120000);\n  try {\n    const response = await fetch(`${PWA_SUPABASE_URL}/functions/v1/upload-image`, {\n      method: 'POST',\n      headers: {\n        Authorization: `Bearer ${PWA_SUPABASE_ANON_KEY}`,\n        apikey: PWA_SUPABASE_ANON_KEY,\n        'x-firebase-token': token,\n      },\n      body: formData,\n      signal: controller.signal,\n    });\n    const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };\n    if (!response.ok) throw new Error(payload.error || `Falha no upload (${response.status}).`);\n    if (!payload.url || !/^https?:\\/\\//i.test(payload.url)) throw new Error("O servidor não retornou a URL do arquivo.");\n    return payload.url;\n  } catch (error) {\n    if (error instanceof DOMException && error.name === 'AbortError') throw new Error("O envio demorou demais e foi cancelado. Tente novamente.");\n    throw error;\n  } finally {\n    window.clearTimeout(timeout);\n  }\n}\n'''

if old not in text:
    if 'PWA_SUPABASE_URL' not in text:
        raise SystemExit('Função de upload antiga não encontrada em managementData.ts')
else:
    text = text.replace(old, new, 1)
management.write_text(text, encoding='utf-8')

panel_text = panel.read_text(encoding='utf-8')
old_catch = 'catch{toast.error("Falha ao enviar imagem.");}finally{setUploading(false);}'
new_catch = 'catch(error){console.error(error);toast.error(error instanceof Error?error.message:"Falha ao enviar imagem.");}finally{setUploading(false);}'
if old_catch in panel_text:
    panel_text = panel_text.replace(old_catch, new_catch, 1)
elif new_catch not in panel_text:
    raise SystemExit('Tratamento de erro do upload não encontrado no Painel Mestre')
panel.write_text(panel_text, encoding='utf-8')

checks = {
    management: ['PWA_SUPABASE_URL', 'x-firebase-token', 'dynamic-pages/pwa/', 'AbortController'],
    panel: ['error instanceof Error?error.message'],
}
for path, needles in checks.items():
    final = path.read_text(encoding='utf-8')
    missing = [n for n in needles if n not in final]
    if missing:
        raise SystemExit(f'{path}: validação falhou: {missing}')
