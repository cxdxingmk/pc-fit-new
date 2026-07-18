import Link from "next/link";
import Container from "./layout/Container";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-100">
      <Container className="flex flex-col gap-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} PC FIT. 부품을 직접 판매하지 않습니다.</p>
        <nav className="flex items-center gap-5">
          <Link href="/privacy" className="transition hover:text-white">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            이용약관
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
