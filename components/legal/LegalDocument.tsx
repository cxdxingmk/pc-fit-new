import type { ReactNode } from "react";

// /privacy, /terms 두 페이지가 공유하는 타이포그래피 프리미티브.
// 별도 마크다운 렌더러(react-markdown 등)를 새로 추가하지 않고, 이미 이 프로젝트 전반에서 쓰는
// "직접 스타일링한 Tailwind JSX" 방식을 그대로 따른다(정적 텍스트 2페이지 때문에 의존성을 늘리지 않음).

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-cyan-300">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-600">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-white/5">
            {head.map((label) => (
              <th key={label} className="px-4 py-2.5 font-semibold text-slate-200">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/10">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 text-slate-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** [담당자 이름]처럼 아직 실제 값이 채워지지 않은 자리표시자를 시각적으로 눈에 띄게 표시한다. */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-300">{children}</span>;
}
