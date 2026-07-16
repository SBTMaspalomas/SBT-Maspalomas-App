export function NewsBoard() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl bg-black p-8 text-center">
      <img
        src="https://kiifznmcpyvalupdtnrq.supabase.co/storage/v1/object/public/avatars/SBT%20logo-.png"
        alt="SBT Maspalomas"
        className="mb-6 h-24 w-24 rounded-full object-cover"
      />
      <h2 className="text-2xl font-black text-white">SBT Maspalomas</h2>
      <p className="mt-2 text-lg text-gray-300">Tablón de anuncios generales</p>
      <p className="mt-4 text-sm font-bold uppercase tracking-widest text-primary">PRÓXIMAMENTE</p>
    </div>
  );
}
