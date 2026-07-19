'use strict';

let audioCtx = null;

function ensureAudio() {
  if (save.muted) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.05, slide = 0, delay = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sfxClick() { tone({ freq: 520, dur: 0.05, type: 'square', gain: 0.02 }); }
function sfxSteer() {
  tone({ freq: 180, dur: 0.04, type: 'triangle', gain: 0.012, slide: 30 });
}
function sfxStar() {
  tone({ freq: 660, dur: 0.08, type: 'sine', gain: 0.04, slide: 120 });
  tone({ freq: 880, dur: 0.1, type: 'triangle', gain: 0.03, delay: 0.05 });
}
function sfxBump() {
  tone({ freq: 140, dur: 0.08, type: 'sine', gain: 0.03, slide: -40 });
}
function sfxFlower() {
  tone({ freq: 520, dur: 0.07, type: 'sine', gain: 0.03, slide: 60 });
  tone({ freq: 700, dur: 0.09, type: 'triangle', gain: 0.025, delay: 0.04 });
}
function sfxFinish() {
  tone({ freq: 523, dur: 0.1, type: 'sine', gain: 0.04 });
  tone({ freq: 659, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.09 });
  tone({ freq: 784, dur: 0.14, type: 'triangle', gain: 0.045, delay: 0.18 });
  tone({ freq: 1046, dur: 0.2, type: 'sine', gain: 0.035, delay: 0.3, slide: 40 });
  tone({ freq: 880, dur: 0.22, type: 'triangle', gain: 0.04, delay: 0.48 });
}
function sfxEngineTick() {
  tone({ freq: 90, dur: 0.04, type: 'triangle', gain: 0.008, slide: 20 });
}
/** Countdown beep — higher pitch for the final GO */
function sfxCountdown(isGo) {
  if (isGo) {
    tone({ freq: 523, dur: 0.12, type: 'sine', gain: 0.05 });
    tone({ freq: 784, dur: 0.18, type: 'triangle', gain: 0.045, delay: 0.08 });
  } else {
    tone({ freq: 392, dur: 0.12, type: 'sine', gain: 0.04 });
  }
}

function speak(text) {
  if (save.muted) return;
  try {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = 1.05;
    u.pitch = 1.2;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch { /* */ }
}

function speakCheer(text) {
  if (!text) return;
  speak(text);
}
