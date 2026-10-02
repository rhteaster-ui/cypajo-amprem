import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold text-white mb-2">Halaman Tidak Ditemukan</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        Halaman yang Anda tuju tidak ditemukan atau sedang dalam proses pembangunan.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
