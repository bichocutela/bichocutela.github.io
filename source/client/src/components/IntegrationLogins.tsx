import "../pages/PromotionsModal.css";
import { useEffect, useState } from "react";
import { remoteRequest } from "@/lib/nrdRemote";
export default function IntegrationLogins() {
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const r = await remoteRequest("nrd-integration-logins", {
        operation: "list",
      });
      setItems(r.providers);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section>
      <h3>Logins</h3>
      <p>
        Teste e troque os acessos de Ofertas, ACP e ACP Tech. A mudança vale
        para Android e PWA, sem outro APK.
      </p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => void load()}>Atualizar acessos</button>
      {[
        ["offers", "Ofertas"],
        ["legacy", "ACP"],
        ["acptech", "ACP Tech"],
      ].map(([provider, label]) => (
        <LoginCard
          key={provider}
          provider={provider}
          label={label}
          status={items.find(s => s.provider === provider)}
          reload={load}
        />
      ))}
    </section>
  );
}
function LoginCard({
  provider,
  label,
  status,
  reload,
}: {
  provider: string;
  label: string;
  status: any;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(save: boolean) {
    setBusy(true);
    setMessage("");
    try {
      await remoteRequest(
        "nrd-integration-logins",
        save
          ? {
              operation: "save",
              provider,
              login,
              password,
              revision: status.revision,
            }
          : { operation: "test", provider, current: true }
      );
      setMessage(
        save ? "Novo acesso testado e salvo." : "Acesso atual funcionando."
      );
      if (save) {
        setLogin("");
        setPassword("");
        setEditing(false);
        await reload();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="nrd-integration-card">
      <h4>{label}</h4>
      <p>
        {status
          ? status.configured
            ? "Acesso configurado"
            : "Acesso não configurado"
          : "Carregando…"}
      </p>
      <div>
        <button
          disabled={!status || busy || !status.configured}
          onClick={() => void run(false)}
        >
          Testar acesso atual
        </button>
        <button
          disabled={!status || busy}
          onClick={() => {
            setEditing(v => !v);
            setLogin("");
            setPassword("");
            setMessage("");
          }}
        >
          {editing ? "Cancelar" : "Alterar acesso"}
        </button>
      </div>
      {editing && (
        <form
          onSubmit={e => {
            e.preventDefault();
            void run(true);
          }}
        >
          <label>
            Novo login
            <input
              autoComplete="off"
              value={login}
              onChange={e => setLogin(e.target.value)}
              maxLength={256}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={512}
            />
          </label>
          <button disabled={busy || !login.trim() || !password}>
            Testar e salvar
          </button>
        </form>
      )}
      {busy && <p role="status">Testando conexão…</p>}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
