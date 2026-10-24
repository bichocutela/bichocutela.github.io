import { useMemo, useState } from "react";
import { ArrowLeft, Bell, X } from "lucide-react";
import { QRCodeWriter, BarcodeFormat } from "@zxing/library";
import {
  trainingInitial,
  pressTraining,
  trainingText,
  trainingImage,
  type TrainingConfig,
  type TrainingKey,
} from "@/lib/training";
import {
  cashierInitial,
  cashierPress,
  practiceProducts,
  type CashierSession,
} from "@/lib/cashier";
import {
  cashierOperator,
  cashierCustomer,
  cashierInstruction,
} from "@/lib/cashierText";
import NotificationSettings from "@/components/NotificationSettings";
import "./TrainingModal.css";
export default function TrainingModal({
  config,
  onClose,
  initialId,
}: {
  config: TrainingConfig;
  onClose: () => void;
  initialId?: string;
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const missions = config.missions.filter(m => m.enabled),
    [opened, setOpened] = useState(!!initialId),
    [state, setState] = useState(() =>
      trainingInitial(
        missions.find(m => m.id === initialId)?.id || missions[0]?.id || ""
      )
    ),
    [session, setSession] = useState(cashierInitial),
    [large, setLarge] = useState(false);
  const mission = missions.find(m => m.id === state.missionId) || missions[0],
    key = config.keys.find(k => k.id === state.displayKey),
    step = mission?.steps[state.step];
  if (!mission) return null;
  const customer =
    state.mode === "LEARN"
      ? cashierCustomer(session)
      : trainingText(
          key?.customerText ||
            (state.finished
              ? "TREINAMENTO CONCLUÍDO"
              : state.mode === "FREE"
                ? "CAIXA FECHADO"
                : step?.customerText || ""),
          state,
          key,
          mission
        );
  const operator =
    state.mode === "LEARN"
      ? cashierOperator(session)
      : trainingText(
          key?.operatorText ||
            (state.finished
              ? "MISSÃO CONCLUÍDA"
              : state.mode === "FREE"
                ? "FECHADO PARA BALANÇA"
                : step?.operatorText || ""),
          state,
          key,
          mission
        );
  function press(id: string) {
    if (state.mode === "LEARN") {
      const k = config.keys.find(k => k.id === id);
      if (!k) return;
      const hour = Number(
        new Intl.DateTimeFormat("en", {
          hour: "numeric",
          hourCycle: "h23",
          timeZone: "America/Fortaleza",
        }).format(new Date())
      );
      setSession(s => cashierPress(s, k.label.replaceAll("\n", " "), hour));
    } else setState(s => pressTraining(config, s, id));
  }
  const simulate = (key: string) => setSession(s => cashierPress(s, key));
  return (
    <div className="nrd-training-backdrop">
      <section
        className="nrd-training"
        role="dialog"
        aria-modal="true"
        aria-label="Academia NRD"
      >
        <header>
          <button
            aria-label="Voltar"
            onClick={() => (opened ? setOpened(false) : onClose())}
          >
            <ArrowLeft />
          </button>
          <h2>Academia NRD</h2>
          <button
            aria-label="Notificações de treinamento"
            onClick={() => setShowNotifications(true)}
          >
            <Bell />
          </button>
          <button aria-label="Fechar treinamento" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="nrd-training-scroll">
          {config.visibility === "TEST" && <p>Modo Teste — somente o Mestre</p>}
          {!opened ? (
            <>
              <h3>Treinamento de Caixa</h3>
              <p>
                Aprender: siga as instruções. Prova: teste sua sequência. Caixa
                Livre: explore as teclas.
              </p>
              <button onClick={() => setOpened(true)}>Abrir simulador</button>
              {missions.map(m => (
                <button
                  className="nrd-training-mission"
                  key={m.id}
                  onClick={() => {
                    setState(trainingInitial(m.id));
                    setOpened(true);
                  }}
                >
                  <strong>{m.title}</strong>
                  <span>{m.subtitle}</span>
                  <small>{m.steps.length} etapas</small>
                </button>
              ))}
            </>
          ) : (
            <>
              <nav>
                {(["LEARN", "EXAM", "FREE"] as const).map(mode => (
                  <button
                    key={mode}
                    aria-pressed={state.mode === mode}
                    onClick={() =>
                      setState(
                        trainingInitial(mission.id, mode, state.completed)
                      )
                    }
                  >
                    {mode === "LEARN"
                      ? "Aprender"
                      : mode === "EXAM"
                        ? "Prova"
                        : "Caixa Livre"}
                  </button>
                ))}
              </nav>
              <select
                aria-label="Missão do treinamento"
                value={mission.id}
                onChange={e =>
                  setState(
                    trainingInitial(e.target.value, state.mode, state.completed)
                  )
                }
              >
                {missions.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <div className="nrd-training-display-row">
                <div>
                  <h3>
                    {state.mode === "LEARN"
                      ? "APRENDER"
                      : state.mode === "EXAM"
                        ? "PROVA"
                        : "CAIXA LIVRE"}
                  </h3>
                  {state.mode === "LEARN" ? (
                    <p>{cashierInstruction(session)}</p>
                  ) : (
                    state.mode === "EXAM" && (
                      <p>
                        {state.finished
                          ? "Missão concluída!"
                          : `${state.step + 1} de ${mission.steps.length}`}{" "}
                        · {state.errors} erro(s)
                      </p>
                    )
                  )}
                </div>
                <button
                  className="nrd-training-customer-mini"
                  onClick={() => setLarge(true)}
                >
                  <strong>VISOR DO CLIENTE</strong>
                  <pre>{customer}</pre>
                  {state.mode === "LEARN" && session.page === "QR" && (
                    <PracticeQr />
                  )}
                  <small>Toque para ampliar</small>
                </button>
              </div>
              <Display
                text={operator}
                image={
                  state.mode === "LEARN"
                    ? ""
                    : key?.operatorImage || step?.operatorImage
                }
              />
              {state.mode === "LEARN" && (
                <>
                  {session.notice && <p role="status">{session.notice}</p>}
                  <div className="nrd-training-conditions">
                    <label>
                      <input
                        type="checkbox"
                        checked={session.registered}
                        onChange={e =>
                          setSession(s => ({
                            ...s,
                            registered: e.target.checked,
                          }))
                        }
                      />{" "}
                      Cliente de treino cadastrado
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={session.stamps}
                        onChange={e =>
                          setSession(s => ({ ...s, stamps: e.target.checked }))
                        }
                      />{" "}
                      Campanha de selos
                    </label>
                  </div>
                  <div className="nrd-training-practice-products">
                    {practiceProducts.map(p => (
                      <button
                        key={p.code}
                        onClick={() => {
                          if (session.page === "SALE")
                            setSession(s => ({ ...s, input: p.code }));
                        }}
                      >
                        {p.name} · {p.code}
                      </button>
                    ))}
                  </div>
                  <Controls
                    session={session}
                    setSession={setSession}
                    simulate={simulate}
                  />
                </>
              )}
              <div className="nrd-training-keyboard">
                <Keyboard rows={config.left} keys={config.keys} press={press} />
                <Keyboard
                  rows={config.right}
                  keys={config.keys}
                  press={press}
                  dark
                />
              </div>
              <Keyboard rows={config.bottom} keys={config.keys} press={press} />
              <button
                onClick={() =>
                  state.mode === "LEARN"
                    ? setSession(cashierInitial())
                    : setState(
                        trainingInitial(mission.id, state.mode, state.completed)
                      )
                }
              >
                Reiniciar {state.mode === "LEARN" ? "atendimento" : "missão"}
              </button>
              {state.history.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </>
          )}
          <p className="nrd-training-note">
            Simulador educativo. Nenhuma compra, consulta de CPF, cobrança ou
            SMS real é realizado. Confirme os procedimentos oficiais da loja.
          </p>
        </div>
        {showNotifications && (
          <div
            className="nrd-training-enlarged"
            role="dialog"
            aria-modal="true"
            aria-label="Notificações de treinamento"
          >
            <section>
              <NotificationSettings trainingOnly />
              <button onClick={() => setShowNotifications(false)}>
                Fechar
              </button>
            </section>
          </div>
        )}
        {large && (
          <div
            className="nrd-training-enlarged"
            role="dialog"
            aria-modal="true"
            aria-label="Visor do cliente ampliado"
          >
            <section>
              <h3>VISOR DO CLIENTE</h3>
              <pre>{customer}</pre>
              {state.mode === "LEARN" && session.page === "QR" && (
                <PracticeQr />
              )}
              {state.mode !== "LEARN" &&
                trainingImage(key?.customerImage || step?.customerImage) && (
                  <img
                    src={trainingImage(
                      key?.customerImage || step?.customerImage
                    )}
                    alt="Visor do cliente"
                  />
                )}
              <button onClick={() => setLarge(false)}>
                Fechar visor ampliado
              </button>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
function Keyboard({
  rows,
  keys,
  press,
  dark = false,
}: {
  rows: string[][];
  keys: TrainingKey[];
  press: (id: string) => void;
  dark?: boolean;
}) {
  return (
    <div className={`nrd-training-key-block${dark ? " is-dark" : ""}`}>
      {rows.map((row, index) => (
        <div key={index}>
          {row.map(id => {
            const key = keys.find(k => k.id === id);
            return (
              <button
                key={id}
                disabled={!key?.label.trim()}
                onClick={() => press(id)}
                className={key?.label === "ENTRA" ? "is-enter" : ""}
              >
                {key?.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
function Display({ text, image }: { text: string; image?: string }) {
  const url = trainingImage(image);
  return (
    <div className="nrd-training-operator">
      <small>VISOR DO OPERADOR</small>
      <pre>{text}</pre>
      {url && <img src={url} alt="Referência do visor do operador" />}
    </div>
  );
}
function Controls({
  session: s,
  setSession,
  simulate,
}: {
  session: CashierSession;
  setSession: React.Dispatch<React.SetStateAction<CashierSession>>;
  simulate: (key: string) => void;
}) {
  if (s.page === "OFFERS_CONFIRM")
    return (
      <button onClick={() => simulate("SIM_ASKED")}>
        Já perguntei sobre ativação das ofertas
      </button>
    );
  if (s.page === "MISSING")
    return (
      <div>
        <button onClick={() => simulate("SIM_MISSING")}>
          Faltou um produto
        </button>
        <button onClick={() => simulate("SIM_FOUND")}>Encontrou tudo</button>
      </div>
    );
  if (s.page === "MISSING_FORM")
    return (
      <div>
        {(["missingName", "missingPhone", "missingProduct"] as const).map(
          (field, i) => (
            <label key={field}>
              {["Nome fictício", "Telefone fictício", "Produto que faltou"][i]}
              <input
                value={s[field]}
                maxLength={field === "missingPhone" ? 20 : 160}
                onChange={e =>
                  setSession(s => ({ ...s, [field]: e.target.value }))
                }
              />
            </label>
          )
        )}
        <button onClick={() => simulate("SIM_SAVE_MISSING")}>
          Concluir anotação de treino
        </button>
      </div>
    );
  if (["CPF", "CNPJ", "PHONE", "PIX_CONFIRM"].includes(s.page))
    return (
      <button onClick={() => simulate("SIM_PIN")}>
        Simular confirmação no PINpad
      </button>
    );
  if (["MAGNETIC", "AGREEMENT", "PARKING"].includes(s.page))
    return (
      <button onClick={() => simulate("SIM_CARD")}>
        Simular leitura do cartão
      </button>
    );
  if (["CARD", "QR"].includes(s.page))
    return (
      <button onClick={() => simulate("SIM_APPROVE")}>
        Simular pagamento autorizado
      </button>
    );
  return null;
}
function PracticeQr() {
  const path = useMemo(() => {
    const matrix = new QRCodeWriter().encode(
      "NRD TREINAMENTO - SIMULACAO SEM PAGAMENTO",
      BarcodeFormat.QR_CODE,
      128,
      128,
      new Map()
    );
    let path = "";
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        if (matrix.get(x, y)) path += `M${x},${y}h1v1h-1z`;
    return path;
  }, []);
  return (
    <svg
      viewBox="0 0 128 128"
      role="img"
      aria-label="QR demonstrativo, sem pagamento"
    >
      <rect width="128" height="128" fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
