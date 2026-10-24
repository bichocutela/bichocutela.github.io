import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { nrdAuth } from "@/lib/firebase";
import { remoteRequest, releaseRemoteSession } from "@/lib/nrdRemote";
export default function NrdAccessForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const name = login.trim().toLowerCase();
    const email = name.includes("@")
      ? name
      : ["mestre", "admin"].includes(name)
        ? `${name}@nrdlojas.com`
        : `${name}@usuarios.nrdlojas.com`;
    try {
      await signInWithEmailAndPassword(nrdAuth, email, password);
      setPassword("");
      const access = await remoteRequest("nrd-promotion-control", {
        operation: "access",
      });
      if (!access.promotions)
        throw Error(
          "Peça ao Mestre para liberar as promoções para esta conta."
        );
      onSuccess();
    } catch (e) {
      await releaseRemoteSession().catch(() => undefined);
      await signOut(nrdAuth);
      setError(
        e instanceof Error && !e.message.includes("Firebase")
          ? e.message
          : "Confira seu usuário NRD, senha e conexão."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="nrd-promo-access" onSubmit={submit}>
      <h3>Acesso às promoções</h3>
      <p>
        Use a mesma conta NRD e as permissões liberadas pelo Mestre no Android.
      </p>
      <label>
        Usuário NRD
        <input
          autoComplete="username"
          value={login}
          onChange={e => setLogin(e.target.value)}
          required
        />
      </label>
      <label>
        Senha
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="nrd-promo-primary" disabled={busy}>
        {busy ? "Verificando..." : "Entrar"}
      </button>
    </form>
  );
}
