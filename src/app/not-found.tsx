import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="label">404</div>
      <h1 className="font-display text-3xl font-normal">Page not found</h1>
      <Link href="/" className="btn btn-ghost mt-2">
        Go home
      </Link>
    </div>
  );
}
