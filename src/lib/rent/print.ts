function sheetCss(): string {
  return `
    @page { margin: 14mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #111;
      font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      padding: 28px 24px;
      border: 1px solid #111;
    }
    h1 { font-family: Georgia, "Times New Roman", serif; font-size: 28px; margin: 0; font-weight: 600; }
    .muted { color: #444; font-size: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; padding: 6px 0; }
    .row b { font-variant-numeric: tabular-nums; }
    hr { border: 0; border-top: 1px solid #ccc; margin: 16px 0; }
    .kicker { letter-spacing: .16em; text-transform: uppercase; font-size: 11px; color: #555; }
    .foot { display: flex; justify-content: space-between; margin-top: 28px; font-size: 12px; color: #444; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    @media print {
      body { background: #fff; }
      .sheet { border-color: #000; }
    }
  `;
}

export function printHtml(title: string, inner: string): void {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${sheetCss()}</style>
</head>
<body>
  ${inner}
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 120);
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=780,height=980");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 800);
  };
  iframe.contentWindow?.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 30_000);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
