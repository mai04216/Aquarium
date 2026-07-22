// サウンドエンジン(F。10章決定: BGM+効果音)
// 音声素材を持たず、WebAudio APIで効果音とアンビエントBGMを手続き生成する。
// 将来的に実ファイル(mp3等)へ差し替えることも可能な構成。

const Sound = (() => {
  const SETTINGS_KEY = "myaquarium_sound";

  let ctx = null;
  let masterGain = null;
  let bgmTimer = null;

  const settings = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { bgm: data.bgm !== false, sfx: data.sfx !== false };
      }
    } catch {
      /* 破損時は既定値 */
    }
    return { bgm: true, sfx: true };
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // 単発の短い音(効果音・BGMの1音に共用)
  function tone(freq, duration, { type = "sine", vol = 0.2, attack = 0.01 } = {}) {
    ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // --- 効果音 ---

  function coin() {
    if (!settings.sfx) return;
    tone(880, 0.12, { type: "triangle", vol: 0.22 });
    setTimeout(() => tone(1320, 0.14, { type: "triangle", vol: 0.18 }), 60);
  }

  function purchase() {
    if (!settings.sfx) return;
    tone(660, 0.1, { type: "square", vol: 0.14 });
    setTimeout(() => tone(990, 0.16, { type: "square", vol: 0.14 }), 80);
  }

  function place() {
    if (!settings.sfx) return;
    tone(520, 0.12, { type: "sine", vol: 0.2 });
  }

  function ui() {
    if (!settings.sfx) return;
    tone(700, 0.08, { type: "sine", vol: 0.12 });
  }

  // --- アンビエントBGM(ペンタトニックの緩やかなループ) ---

  const scale = [261.63, 293.66, 329.63, 392.0, 440.0]; // C D E G A

  function startBgm() {
    if (!settings.bgm || bgmTimer) return;
    ensureCtx();
    bgmTimer = setInterval(() => {
      const octave = Math.random() < 0.3 ? 2 : 1;
      const freq = scale[Math.floor(Math.random() * scale.length)] * octave;
      tone(freq, 2.3, { type: "sine", vol: 0.06, attack: 0.4 });
    }, 1600);
  }

  function stopBgm() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
  }

  // --- 設定 ---

  function setBgm(enabled) {
    settings.bgm = enabled;
    saveSettings();
    if (enabled) startBgm();
    else stopBgm();
  }

  function setSfx(enabled) {
    settings.sfx = enabled;
    saveSettings();
  }

  function getSettings() {
    return { ...settings };
  }

  // 最初のユーザー操作で AudioContext を起動し、BGMを開始する(自動再生制限対策)
  function unlockOnFirstGesture() {
    const handler = () => {
      ensureCtx();
      startBgm();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
  }

  return { coin, purchase, place, ui, setBgm, setSfx, getSettings, unlockOnFirstGesture };
})();
