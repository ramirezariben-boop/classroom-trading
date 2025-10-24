// app/admin/page.tsx
import ExportUsersButton from "./_components/ExportUsersButton";

export default function AdminPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <ExportUsersButton />
      </div>
      <p className="text-sm text-gray-500">/admin cargó ok.</p>
    </div>
  );
}
