import { invoke } from "@tauri-apps/api/core";
import { mountAgentPanel } from "./agentPanel";

type AuthInfo = { signed_in: boolean; email: string | null; access_token?: string | null };

const TOOLS_API = "https://api.tools.ai-forall.org";

let mode: "video" | "audio" = "video";
let busy = false;
let agentRefresh: (() => void) | undefined;

function setStatus(text: string, kind: "ok" | "err" | "" = "") {
  const el = document.querySelector("#status");
  if (!el) return;
  el.textContent = text;
  el.className = `status${kind ? ` ${kind}` : ""}`;
}

function setBusy(next: boolean) {
  busy = next;
  const run = document.querySelector<HTMLButtonElement>("#run");
  if (run) {
    run.disabled = next;
    run.textContent = next ? "Working…" : "Translate";
  }
}

function renderAuth(info: AuthInfo) {
  const label = document.querySelector("#account-label");
  const btn = document.querySelector<HTMLButtonElement>("#auth-btn");
  if (label) label.textContent = info.signed_in ? info.email || "Signed in" : "Not signed in";
  if (btn) btn.textContent = info.signed_in ? "Sign out" : "Sign in";
  agentRefresh?.();
}

async function refreshAuth() {
  try {
    renderAuth(await invoke<AuthInfo>("get_auth"));
  } catch {
    renderAuth({ signed_in: false, email: null });
  }
}

async function toggleAuth() {
  const btn = document.querySelector<HTMLButtonElement>("#auth-btn");
  if (btn) btn.disabled = true;
  setStatus("");
  try {
    const current = await invoke<AuthInfo>("get_auth");
    const info = current.signed_in
      ? await invoke<AuthInfo>("sign_out")
      : await invoke<AuthInfo>("sign_in");
    renderAuth(info);
    if (info.signed_in) setStatus("Signed in.", "ok");
  } catch (err) {
    setStatus(String(err), "err");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function syncModeUi() {
  const file = document.querySelector<HTMLInputElement>("#file");
  const output = document.querySelector<HTMLSelectElement>("#output");
  const videoBtn = document.querySelector("#mode-video");
  const audioBtn = document.querySelector("#mode-audio");
  videoBtn?.classList.toggle("on", mode === "video");
  audioBtn?.classList.toggle("on", mode === "audio");
  if (file) file.accept = mode === "video" ? "video/*" : "audio/*";
  if (output) {
    if (mode === "video") {
      output.innerHTML = `
        <option value="video" selected>Translated video</option>
        <option value="text">Text only</option>`;
    } else {
      output.innerHTML = `
        <option value="audio" selected>Translated audio</option>
        <option value="text">Text only</option>`;
    }
  }
}

async function runTranslate() {
  if (busy) return;
  const fileInput = document.querySelector<HTMLInputElement>("#file");
  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus("Choose a file first.", "err");
    return;
  }
  const auth = await invoke<AuthInfo>("get_auth").catch(() => ({ signed_in: false, email: null } as AuthInfo));
  if (!auth.signed_in || !auth.access_token) {
    setStatus("Please sign in to translate.", "err");
    return;
  }

  const toolId = mode === "video" ? "video_translate" : "audio_translate";
  const output = document.querySelector<HTMLSelectElement>("#output")?.value || (mode === "video" ? "video" : "audio");
  const sourceLanguage = document.querySelector<HTMLSelectElement>("#source-language")?.value || "auto";
  const language = document.querySelector<HTMLSelectElement>("#language")?.value || "en";

  const form = new FormData();
  form.set("files", file);
  form.set("output", output);
  form.set("source_language", sourceLanguage);
  form.set("language", language);
  form.set("client", "desktop");
  form.set("job_id", crypto.randomUUID().replace(/-/g, ""));

  setBusy(true);
  setStatus("Translating… this can take a few minutes for long clips.");
  const textOut = document.querySelector<HTMLElement>("#text-out");
  const downloads = document.querySelector("#downloads");
  if (textOut) {
    textOut.hidden = true;
    textOut.textContent = "";
  }
  if (downloads) downloads.innerHTML = "";

  try {
    const res = await fetch(`${TOOLS_API}/api/tools/${toolId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.access_token}` },
      body: form,
    });
    const raw = await res.text();
    let data: {
      message?: string;
      downloads?: { name: string; url: string }[];
      meta?: { transcript?: string; translation?: string };
      detail?: unknown;
    } = {};
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error(raw || res.statusText);
    }
    if (!res.ok) {
      const detail = typeof data.detail === "string" ? data.detail : raw;
      throw new Error(String(detail || `HTTP ${res.status}`));
    }
    setStatus(data.message || "Done.", "ok");
    const transcript = data.meta?.transcript || "";
    const translation = data.meta?.translation || "";
    if (textOut && (transcript || translation)) {
      textOut.hidden = false;
      textOut.textContent = [
        transcript ? `Original:\n${transcript}` : "",
        translation ? `Translation:\n${translation}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (downloads && data.downloads?.length) {
      for (const item of data.downloads) {
        const a = document.createElement("a");
        a.className = "btn ghost";
        a.href = item.url.startsWith("http") ? item.url : `${TOOLS_API}${item.url}`;
        a.download = item.name;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = item.name;
        downloads.appendChild(a);
      }
    }
  } catch (err) {
    setStatus(String(err), "err");
  } finally {
    setBusy(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  syncModeUi();
  document.querySelector("#mode-video")?.addEventListener("click", () => {
    mode = "video";
    syncModeUi();
  });
  document.querySelector("#mode-audio")?.addEventListener("click", () => {
    mode = "audio";
    syncModeUi();
  });
  document.querySelector("#run")?.addEventListener("click", () => void runTranslate());
  document.querySelector("#auth-btn")?.addEventListener("click", () => void toggleAuth());

  const mainView = document.querySelector("#view-main");
  const contactView = document.querySelector("#view-contact");
  const showContact = (on: boolean) => {
    mainView?.classList.toggle("hidden", on);
    contactView?.classList.toggle("hidden", !on);
    if (contactView instanceof HTMLElement) contactView.hidden = !on;
  };
  document.querySelector("#contact-btn")?.addEventListener("click", () => showContact(true));
  document.querySelector("#contact-back")?.addEventListener("click", () => showContact(false));

  const agentMount = document.querySelector<HTMLElement>("#agent-root");
  if (agentMount) {
    const panel = mountAgentPanel({
      mount: agentMount,
      productHint: "Media Translate desktop app (Windows/Mac) — video and audio translation",
      getAccessToken: async () => {
        try {
          const info = await invoke<AuthInfo>("get_auth");
          return info.access_token || null;
        } catch {
          return null;
        }
      },
    });
    agentRefresh = panel.refreshAuthHint;
  }

  void refreshAuth();
});
