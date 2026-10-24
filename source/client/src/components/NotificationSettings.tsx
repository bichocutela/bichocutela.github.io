import { useEffect, useState } from "react";
import {
  defaultNotifications,
  readNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
export default function NotificationSettings({
  encartesOnly = false,
  trainingOnly = false,
}: {
  encartesOnly?: boolean;
  trainingOnly?: boolean;
}) {
  const [prefs, setPrefs] =
      useState<NotificationPreferences>(defaultNotifications),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void readNotificationPreferences().then(setPrefs);
  }, []);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      if (
        ((encartesOnly && prefs.encarteMode !== "OFF") ||
          (trainingOnly && prefs.trainingEnabled)) &&
        !prefs.enabled
      )
        throw Error(
          "Ative primeiro as notificações gerais nas Configurações do NRD."
        );
      setPrefs(await saveNotificationPreferences(prefs));
      setMessage("Preferências de notificação salvas.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const flags: [keyof NotificationPreferences, string][] = [
    ["enabled", "Notificações habilitadas"],
    ["productAdded", "Produto adicionado"],
    ["codeChanged", "Código alterado"],
    ["suggestionFixed", "Sugestão corrigida"],
    ["appUpdate", "Atualização do aplicativo"],
    ["promotionUpdated", "Promoções atualizadas"],
    ["trainingEnabled", "Novos treinamentos"],
  ];
  return (
    <section className="nrd-notification-settings">
      <h3>
        {encartesOnly
          ? "Notificações de encartes"
          : trainingOnly
            ? "Notificações de treinamento"
            : "Notificações"}
      </h3>
      {!encartesOnly &&
        flags
          .filter(([key]) => !trainingOnly || key === "trainingEnabled")
          .map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={prefs[key] === true}
                disabled={busy}
                onChange={e =>
                  setPrefs(v => ({ ...v, [key]: e.target.checked }))
                }
              />
            </label>
          ))}
      {!trainingOnly && (
        <fieldset>
          <legend>Novos encartes de Natal e região</legend>
          {(
            [
              ["OFF", "Desativadas", "Não receber avisos"],
              ["SIMPLE", "Simples", "Avisar que existe um novo encarte"],
              [
                "DETAILED",
                "Detalhadas",
                "Mostrar o nome completo e a validade",
              ],
            ] as const
          ).map(([mode, label, description]) => (
            <label key={mode}>
              <input
                type="radio"
                name="encarte-mode"
                checked={prefs.encarteMode === mode}
                onChange={() => setPrefs(v => ({ ...v, encarteMode: mode }))}
                disabled={busy}
              />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <p>
        O navegador precisa permitir as notificações. No iPhone, abra pela Tela
        de Início.
      </p>
      {message && <p role="status">{message}</p>}
      <button
        className="nrd-promo-primary"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Salvando…" : "Salvar notificações"}
      </button>
    </section>
  );
}
