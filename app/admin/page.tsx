import ExportUsersButton from './_components/ExportUsersButton';

export default function AdminPage() {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Panel Admin</h1>
        <ExportUsersButton />
      </div>
      {/* …tu resto del panel… */}
    </div>
  );
}
