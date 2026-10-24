import { nrdAuth } from "./firebase";

const env =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
const base = (
  env.VITE_SUPABASE_URL || "https://kkayksyzksexoarpfxyj.supabase.co"
).replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
let claimedUid = "";
let claiming: Promise<void> | null = null;
function deviceToken() {
  let token = localStorage.getItem("nrd-device-session");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b =>
      b.toString(16).padStart(2, "0")
    ).join("");
    localStorage.setItem("nrd-device-session", token);
  }
  return token;
}
export async function remoteRequest(
  service: string,
  body?: Record<string, unknown>,
  scope = ""
): Promise<any> {
  await nrdAuth.authStateReady();
  const user = nrdAuth.currentUser;
  const token = await user?.getIdToken(false);
  const restricted = user?.email?.endsWith("@usuarios.nrdlojas.com");
  if (
    user &&
    restricted &&
    claimedUid !== user.uid &&
    service !== "nrd-account-admin/session"
  ) {
    if (!claiming)
      claiming = remoteRequest("nrd-account-admin/session", {
        action: "claim",
        deviceToken: deviceToken(),
      })
        .then(() => {
          claimedUid = user.uid;
        })
        .finally(() => {
          claiming = null;
        });
    await claiming;
  }
  const response = await fetch(`${base}/functions/v1/${service}`, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(150000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "x-firebase-token": token } : {}),
      ...(restricted ? { "x-device-session": deviceToken() } : {}),
      ...(scope ? { "x-nrd-scope": scope } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: Record<string, string> = {
      ACCESS_DENIED:
        "Entre com uma conta NRD liberada pelo Mestre para acessar as promoções.",
      AUTH_REQUIRED: "Entre novamente na sua conta NRD.",
      DEVICE_IN_USE:
        "Esta conta está em uso em outro aparelho. Saia de lá para entrar aqui.",
      LOGIN_TEST_FAILED:
        "O acesso não passou no teste. O acesso anterior foi mantido.",
      CREDENTIAL_CONFLICT:
        "Outro aparelho alterou este acesso. Atualize e tente novamente.",
      LOGIN_IN_USE:
        "As ofertas estão sendo consultadas. Aguarde e tente novamente.",
      LOGIN_RECOVERY_PENDING:
        "Uma consulta de ofertas precisa ser concluída antes de trocar a conta.",
    };
    throw new Error(
      messages[payload.error] ||
        "Não foi possível atualizar agora. Tente novamente."
    );
  }
  return payload;
}
export async function releaseRemoteSession() {
  if (nrdAuth.currentUser?.email?.endsWith("@usuarios.nrdlojas.com")) {
    await remoteRequest("nrd-account-admin/session", {
      action: "release",
      deviceToken: deviceToken(),
    });
  }
  claimedUid = "";
}
export async function readPromotionConfig(path: string) {
  return (
    (await remoteRequest("nrd-promotion-control", { operation: "read", path }))
      .data ?? {}
  );
}
