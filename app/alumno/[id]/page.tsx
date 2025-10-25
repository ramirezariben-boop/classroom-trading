import { prisma } from "@/app/lib/prisma";

export default async function AlumnoPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({ where: { id: params.id } });

  if (!user) {
    return <div className="p-6 text-red-600">Alumno no encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Bienvenido, {user.name ?? user.id}</h1>
        <p className="text-center text-gray-700 mb-2">Puntos actuales:</p>
        <p className="text-center text-4xl font-bold text-green-600">{user.points ?? 0}</p>
      </div>
    </div>
  );
}
