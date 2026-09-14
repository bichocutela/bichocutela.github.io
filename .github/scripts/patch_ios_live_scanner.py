from pathlib import Path
import re

p = Path("source/client/src/pages/ProductConsultation.tsx")
s = p.read_text(encoding="utf-8")

s = s.replace('  const nativeCaptureInputRef = useRef<HTMLInputElement>(null);\n  const [nativeCaptureBusy, setNativeCaptureBusy] = useState(false);\n', '')
start = s.find('  function isIosDevice()')
end = s.find('  function openCameraScanner()', start)
if start < 0 or end < 0:
    raise SystemExit('Bloco antigo do iPhone não encontrado')
s = s[:start] + s[end:]

old_camera = re.compile(r'''\s*\{isIosDevice\(\) \? <label className=\{`pc-camera-button pc-native-camera-button\$\{nativeCaptureBusy \? " is-disabled" : ""\}`\} aria-label="Ler código pela câmera">.*?</label> : <button className="pc-camera-button" onClick=\{openCameraScanner\} aria-label="Ler código pela câmera"><Camera /></button>\}''', re.S)
replacement = '\n        <button className="pc-camera-button" onClick={openCameraScanner} aria-label="Ler código pela câmera"><Camera /></button>'
s, count = old_camera.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'Botão antigo do iPhone não encontrado: {count}')

marker = 'function CameraScanner'
idx = s.find(marker)
if idx < 0:
    raise SystemExit('CameraScanner antigo não encontrado')
s = s[:idx] + s[idx:].replace(marker, 'function LegacyCameraScanner', 1)

scanner = r'''
function CameraScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<{ stop: () => void | Promise<void> } | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState("Preparando câmera...");
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    let disposed = false;
    let watchdog = 0;
    let startTime = 0;

    const stopEverything = async () => {
      try { await controlsRef.current?.stop(); } catch { /* já parada */ }
      controlsRef.current = null;
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const boot = async () => {
      try {
        const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (disposed || !videoRef.current) return;

        const hints = new Map<any, any>();
        hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
          zxing.BarcodeFormat.EAN_13,
          zxing.BarcodeFormat.EAN_8,
          zxing.BarcodeFormat.UPC_A,
          zxing.BarcodeFormat.UPC_E,
          zxing.BarcodeFormat.CODE_128,
          zxing.BarcodeFormat.CODE_39,
          zxing.BarcodeFormat.ITF,
        ]);
        hints.set(zxing.DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 20,
          delayBetweenScanSuccess: 400,
        });

        setStatus("Aponte para o código de barras");
        startTime = performance.now();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
          },
          videoRef.current,
          async (result) => {
            if (!result || detectedRef.current || disposed) return;
            const value = result.getText().trim();
            if (!value) return;
            detectedRef.current = true;
            try { await controlsRef.current?.stop(); } catch { /* leitura já concluída */ }
            onDetectedRef.current(value);
          },
        );
        if (disposed) {
          await controls.stop();
          return;
        }
        controlsRef.current = controls;

        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (track) {
          try {
            const caps = (track.getCapabilities?.() ?? {}) as any;
            const advanced: any[] = [];
            if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) advanced.push({ focusMode: "continuous" });
            if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) advanced.push({ exposureMode: "continuous" });
            if (advanced.length) await track.applyConstraints({ advanced } as any);
          } catch { /* iOS pode não expor controles avançados */ }
        }

        let lastTime = videoRef.current.currentTime;
        watchdog = window.setInterval(() => {
          if (disposed || detectedRef.current || !videoRef.current) return;
          const now = videoRef.current.currentTime;
          if (performance.now() - startTime > 2800 && Math.abs(now - lastTime) < 0.01) {
            setStatus("A câmera travou no iOS. Use a foto abaixo ou reabra o leitor.");
            setFallbackVisible(true);
          }
          lastTime = now;
        }, 900);
      } catch {
        if (disposed) return;
        setStatus("Não consegui manter a câmera ao vivo neste iPhone.");
        setFallbackVisible(true);
      }
    };

    void boot();
    return () => {
      disposed = true;
      if (watchdog) window.clearInterval(watchdog);
      void stopEverything();
    };
  }, []);

  async function scanFallbackPhoto(file: File) {
    setFallbackBusy(true);
    setStatus("Lendo foto...");
    const host = document.createElement("div");
    host.id = `nrd-fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "-10000px";
    host.style.width = "480px";
    host.style.height = "480px";
    document.body.appendChild(host);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(host.id, { verbose: false });
      const code = (await scanner.scanFile(file, true)).trim();
      try { await scanner.clear(); } catch { /* opcional */ }
      if (!code) throw new Error("sem código");
      detectedRef.current = true;
      onDetectedRef.current(code);
    } catch {
      setStatus("Não identifiquei o código. Enquadre as barras inteiras e tente outra vez.");
    } finally {
      host.remove();
      setFallbackBusy(false);
      if (fallbackInputRef.current) fallbackInputRef.current.value = "";
    }
  }

  return <div className="pc-modal-backdrop">
    <section className="pc-camera-modal">
      <header>
        <div><p>Leitor contínuo</p><h2>Código de barras</h2></div>
        <button onClick={onClose} aria-label="Fechar"><X /></button>
      </header>
      <div className="pc-camera-stage pc-camera-stage--live">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="pc-camera-target" aria-hidden="true"><span /></div>
      </div>
      <p className="pc-camera-status">{status}</p>
      {fallbackVisible && <label className={`pc-camera-fallback${fallbackBusy ? " is-disabled" : ""}`}>
        <Camera size={18} /> {fallbackBusy ? "Analisando..." : "Usar câmera para tirar uma foto"}
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={fallbackBusy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void scanFallbackPhoto(file);
          }}
        />
      </label>}
      <button className="pc-camera-close" onClick={onClose}>Fechar</button>
    </section>
  </div>;
}

'''
s = s[:idx] + scanner + s[idx:]
p.write_text(s, encoding="utf-8")

css = Path("source/client/src/pages/ProductConsultation.css")
c = css.read_text(encoding="utf-8")
addition = '''\n.pc-camera-stage--live{background:#050505}.pc-camera-stage--live video{z-index:1;transform:translateZ(0);will-change:contents}.pc-camera-target{position:absolute;z-index:5;left:7%;right:7%;top:50%;height:42%;transform:translateY(-50%);border:2px solid rgba(255,208,0,.95);border-radius:18px;box-shadow:0 0 0 999px rgba(0,0,0,.13),0 0 18px rgba(255,208,0,.25);pointer-events:none}.pc-camera-target span{position:absolute;left:7%;right:7%;top:50%;height:2px;background:#ffd000;box-shadow:0 0 14px #ffd000;animation:pc-scan 1.2s ease-in-out infinite}.pc-camera-status{min-height:24px;margin:12px 0 8px!important;font-weight:700;color:#555!important}.pc-camera-fallback{position:relative;overflow:hidden;width:100%;min-height:46px;border-radius:13px;background:#b49116;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0;cursor:pointer}.pc-camera-fallback.is-disabled{opacity:.55;pointer-events:none}.pc-camera-fallback input{position:absolute;inset:0;width:100%;height:100%;opacity:.001;cursor:pointer}\n'''
if '.pc-camera-stage--live{' not in c:
    css.write_text(c + addition, encoding="utf-8")
