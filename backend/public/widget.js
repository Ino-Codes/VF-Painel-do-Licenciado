(function () {
  const scriptTag =
    document.currentScript || document.querySelector("script[data-token]");

  const TOKEN = scriptTag ? scriptTag.getAttribute("data-token") : null;
  const API_BASE = scriptTag
    ? scriptTag.getAttribute("data-api") || "https://painel.vcorporate.com.br"
    : "https://painel.vcorporate.com.br";

  if (!TOKEN) {
    console.warn("[TicketWidget] data-token não informado.");
    return;
  }

  // ── Estilos ─────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #__fw-btn {
      position: fixed;
      bottom: 26px;
      right: 26px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #1e1e1e;
      color: #fff;
      border: 1px solid var(--bg-secondary);
      cursor: pointer;
      font-size: 22px;
      box-shadow: var(--box-shadow);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #__fw-btn:hover {
      transform: scale(1.1);
      box-shadow: var(--box-shadow);
      border-color: #1e1e1e;
    }
    #__fw-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 999998;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 88px 24px;
      animation: __fw-fade-in 0.2s ease;
    }
    @keyframes __fw-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    #__fw-iframe {
      width: 380px;
      height: 520px;
      border: none;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      animation: __fw-slide-up 0.25s ease;
    }
    @keyframes __fw-slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    #__fw-toast {
      position: fixed;
      bottom: 90px;
      right: 24px;
      background: #1a1a2e;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      z-index: 999999;
      font-family: sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: __fw-fade-in 0.2s ease;
    }
  `;
  document.head.appendChild(style);

  // ── Botão flutuante ──────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = "__fw-btn";
  btn.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  btn.title = "Abrir Chamado";
  document.body.appendChild(btn); // ← DEVE vir antes do addEventListener

  // ── overlay declarado no escopo da IIFE ──────────────────────────────────
  let overlay = null; // ← CORRETO: declarado antes de ser usado

  btn.addEventListener("click", function () {
    if (overlay) {
      closeWidget();
      return;
    }
    openWidget();
  });

  function openWidget() {
    overlay = document.createElement("div");
    overlay.id = "__fw-overlay";
    overlay.addEventListener("click", closeWidget);

    const iframe = document.createElement("iframe");
    iframe.id = "__fw-iframe";
    iframe.src = `${API_BASE}/widget-form.html?token=${TOKEN}&origin=${encodeURIComponent(window.location.href)}`;
    iframe.addEventListener("click", (e) => e.stopPropagation());

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    window.addEventListener("message", handleMessage);
  }

  function closeWidget() {
    if (overlay && document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    overlay = null;
    window.removeEventListener("message", handleMessage);
  }

  function handleMessage(event) {
    if (!event.origin.includes(new URL(API_BASE).hostname)) return;
    if (event.data === "fw:close") closeWidget();
    if (event.data === "fw:submitted") {
      closeWidget();
      showThankYou();
    }
  }

  function showThankYou() {
    const toast = document.createElement("div");
    toast.id = "__fw-toast";
    toast.innerText = "Chamado aberto! Obrigado 🙌";
    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) document.body.removeChild(toast);
    }, 4000);
  }
})();
