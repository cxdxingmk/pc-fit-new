import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/app/lib/supabase/getServerAuthUser";
import { shouldRedirectFromAdmin } from "@/app/lib/adminGuard";
import AdminSupportClient from "./AdminSupportClient";

// 서버 컴포넌트 가드 — proxy.ts는 의도적으로 라우트 리다이렉트를 하지 않으므로(세션 갱신 실패가
// 페이지 전체를 503으로 만들 위험을 피하기 위함, proxy.ts 참고) 관리자 판별은 여기서 한다.
// getServerAuthUser()는 실패 시 예외를 던지지 않고 null로 폴백하는 계약이라 비관리자와 동일하게
// 처리되며(둘 다 홈으로 리다이렉트), 이 시도가 실제 관리자를 일시적으로 튕겨낼 수 있다는 점은
// 이 사이트의 다른 페이지들도 이미 감수하고 있는 동일한 트레이드오프다.
export default async function AdminSupportPage() {
  const user = await getServerAuthUser();
  if (shouldRedirectFromAdmin(user)) {
    redirect("/");
  }

  return <AdminSupportClient />;
}
