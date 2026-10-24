export type TrainingKey = {
  id: string;
  label: string;
  action: string;
  value: string;
  operatorText: string;
  customerText: string;
  operatorImage?: string;
  customerImage?: string;
  overrideGuided?: boolean;
};
export type TrainingStep = {
  keyId: string;
  operatorText: string;
  customerText: string;
  instruction: string;
  operatorImage?: string;
  customerImage?: string;
};
export type TrainingMission = {
  id: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  steps: TrainingStep[];
};
export type TrainingConfig = {
  visibility: "OFF" | "TEST" | "ALL";
  revision: number;
  keys: TrainingKey[];
  missions: TrainingMission[];
  left: string[][];
  right: string[][];
  bottom: string[][];
};
export type TrainingState = {
  missionId: string;
  mode: "LEARN" | "EXAM" | "FREE";
  step: number;
  errors: number;
  finished: boolean;
  input: string;
  history: string[];
  completed: string[];
  displayKey: string | null;
};
export const trainingInitial = (
  missionId: string,
  mode: TrainingState["mode"] = "LEARN",
  completed: string[] = []
): TrainingState => ({
  missionId,
  mode,
  step: 0,
  errors: 0,
  finished: false,
  input: "",
  history: [],
  completed,
  displayKey: null,
});
export function parseTraining(
  raw: string,
  visibility: string,
  revision: number
): TrainingConfig | null {
  try {
    const c = JSON.parse(raw);
    if (
      !["OFF", "TEST", "ALL"].includes(visibility) ||
      !Array.isArray(c.keys) ||
      !c.keys.length ||
      c.keys.length > 100 ||
      new Set(c.keys.map((k: TrainingKey) => k.id)).size !== c.keys.length ||
      !Array.isArray(c.missions) ||
      c.missions.length > 60 ||
      !c.missions.length
    )
      return null;
    const ids = new Set(c.keys.map((k: TrainingKey) => k.id));
    if (
      c.missions.some(
        (m: TrainingMission) =>
          !m.title ||
          !Array.isArray(m.steps) ||
          !m.steps.length ||
          m.steps.length > 100 ||
          m.steps.some(s => !ids.has(s.keyId))
      )
    )
      return null;
    for (const layout of ["left", "right", "bottom"])
      if (
        !Array.isArray(c[layout]) ||
        c[layout].some(
          (row: unknown) => !Array.isArray(row) || row.some(id => !ids.has(id))
        )
      )
        return null;
    return { ...c, visibility, revision };
  } catch {
    return null;
  }
}
export function pressTraining(
  c: TrainingConfig,
  s: TrainingState,
  id: string
): TrainingState {
  const key = c.keys.find(k => k.id === id && k.label.trim()),
    mission = c.missions.find(m => m.id === s.missionId);
  if (!key || !mission || (s.finished && s.mode !== "FREE")) return s;
  const reset = () => trainingInitial(s.missionId, s.mode, s.completed);
  if (s.mode !== "FREE" && mission.steps[s.step]?.keyId !== id)
    return s.mode === "EXAM"
      ? { ...reset(), errors: s.errors + 1 }
      : {
          ...s,
          errors: s.errors + 1,
          history: [`✕ ${key.label}`, ...s.history].slice(0, 8),
        };
  if (key.action === "RESET") return reset();
  const input =
    key.action === "APPEND"
      ? (s.input + key.value).slice(0, 120)
      : key.action === "CLEAR"
        ? ""
        : key.action === "BACK"
          ? s.input.slice(0, -1)
          : s.input;
  const next = {
    ...s,
    input,
    displayKey: s.mode === "FREE" || key.overrideGuided ? id : null,
    history: [`✓ ${key.label}`, ...s.history].slice(0, 8),
  };
  if (s.mode === "FREE") return next;
  if (key.action === "BACK") return { ...next, step: Math.max(0, s.step - 1) };
  return s.step >= mission.steps.length - 1
    ? {
        ...next,
        finished: true,
        completed: Array.from(new Set([...s.completed, mission.id])),
      }
    : { ...next, step: s.step + 1 };
}
export function trainingText(
  text: string,
  s: TrainingState,
  key: TrainingKey | undefined,
  mission: TrainingMission
) {
  return text
    .replaceAll("{entrada}", s.input)
    .replaceAll("{tecla}", key?.label.replaceAll("\n", " ") || "")
    .replaceAll("{missao}", mission.title);
}
export function trainingImage(raw: string = "") {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    if (
      ["drive.google.com", "www.drive.google.com", "docs.google.com"].includes(
        url.hostname
      )
    ) {
      const id =
        url.pathname.match(
          /\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})(?:\/|$)/
        )?.[1] || url.searchParams.get("id");
      if (id && /^[A-Za-z0-9_-]{10,}$/.test(id))
        return url.searchParams.get("resourcekey")
          ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200&resourcekey=${encodeURIComponent(url.searchParams.get("resourcekey")!)}`
          : `https://lh3.googleusercontent.com/d/${id}`;
    }
    return raw;
  } catch {
    return "";
  }
}
