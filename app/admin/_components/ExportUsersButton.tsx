// app/admin/_components/ExportUsersButton.tsx
'use client';

import * as React from 'react';

function getFilenameFromHeader(h: string | null) {
  if (!h) return `users-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
  const m = /filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i.exec(h);
  try { return decodeURIComponent((m?.[1] ?? '').replace(/\"/g, '')) || 'users.csv'; } catch {
    return 'users.csv';
  }
}

export default function ExportUsersButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      const url = `/api/admin/users/export${qs}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Export falló: ${res.status} ${text}`);
      }
      const cd = res.headers.get('content-disposition');
      const filename = getFilenameFromHeader(cd);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error(err);
      alert('No pude exportar el CSV. Revisa la consola para detalles.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
      title="Descargar users.csv"
    >
      {loading ? 'Exportando…' : 'Exportar CSV'}
    </button>
  );
}
