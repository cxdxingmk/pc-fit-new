import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 페이지 전역 좌우 정렬 기준선. 헤더/본문/푸터가 전부 이 컴포넌트를 공유해야
 * 좌우 정렬선이 일치한다(하나만 다른 max-width/padding을 쓰면 착시가 생김).
 * 폼 중심 페이지(profile/register-pc/support/signup)는 의도적으로 더 좁은 폭을
 * 쓰므로 이 컴포넌트 대상에서 제외한다.
 */
export default function Container({ children, className }: ContainerProps) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
