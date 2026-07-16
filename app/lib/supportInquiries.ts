import { createClient } from "./supabase/client";

export type SupportInquiryStatus = "pending" | "answered";

export interface SupportInquiry {
  id: string;
  subject: string;
  message: string;
  status: SupportInquiryStatus;
  adminReply: string | null;
  createdAt: string;
  answeredAt: string | null;
  userRead: boolean;
}

export interface AdminSupportInquiry extends SupportInquiry {
  userId: string;
  authorNickname: string;
}

interface SupportInquiryRow {
  id: string;
  subject: string;
  message: string;
  status: SupportInquiryStatus;
  admin_reply: string | null;
  created_at: string;
  answered_at: string | null;
  user_read: boolean;
}

interface AdminSupportInquiryRow extends SupportInquiryRow {
  user_id: string;
  profiles: { nickname: string } | null;
}

function mapRow(row: SupportInquiryRow): SupportInquiry {
  return {
    id: row.id,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    userRead: row.user_read,
  };
}

function mapAdminRow(row: AdminSupportInquiryRow): AdminSupportInquiry {
  return {
    ...mapRow(row),
    userId: row.user_id,
    authorNickname: row.profiles?.nickname ?? "알 수 없음",
  };
}

export async function createSupportInquiry(input: { subject: string; message: string }): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase.from("support_inquiries").insert({
    user_id: user.id,
    subject: input.subject,
    message: input.message,
  });

  return { error: error ? "문의 등록에 실패했어요. 다시 시도해 주세요." : null };
}

export async function getMyInquiries(): Promise<SupportInquiry[] | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("support_inquiries")
    .select("id, subject, message, status, admin_reply, created_at, answered_at, user_read")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return null;
  return (data as SupportInquiryRow[]).map(mapRow);
}

export async function markSupportInquiryRead(inquiryId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_support_inquiry_read", { inquiry_id: inquiryId });
  return { error: error ? "읽음 처리에 실패했어요." : null };
}

// ── 관리자 전용 ──────────────────────────────────────────────────────────
// 아래 두 함수는 RLS로 이미 보호되지만(비관리자는 본인 행만 보임/수정 불가), 비관리자가
// 실수로 이 경로를 타면 "빈 목록"처럼 조용히 새는 대신 명확한 실패를 주기 위해 앞단에서
// is_admin을 한 번 더 확인한다.
async function requireAdmin(supabase: ReturnType<typeof createClient>): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { error: "관리자만 접근할 수 있어요." };

  return { userId: user.id };
}

export async function getAllInquiriesForAdmin(): Promise<AdminSupportInquiry[] | null> {
  const supabase = createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return null;

  const { data, error } = await supabase
    .from("support_inquiries")
    .select("id, user_id, subject, message, status, admin_reply, created_at, answered_at, user_read, profiles(nickname)")
    .order("created_at", { ascending: false });

  if (error || !data) return null;

  const rows = data as unknown as AdminSupportInquiryRow[];
  // status 알파벳 정렬('answered' > 'pending')이 우연히 원하는 순서와 같다고 해서 거기 기대지
  // 않는다 — 상태값이 하나만 늘어도 조용히 깨진다. pending을 명시적으로 앞에 오도록 정렬한다.
  return [...rows].sort((a, b) => (a.status === b.status ? 0 : a.status === "pending" ? -1 : 1)).map(mapAdminRow);
}

export async function answerSupportInquiry(inquiryId: string, reply: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return { error: guard.error };

  const { error } = await supabase
    .from("support_inquiries")
    .update({
      status: "answered",
      admin_reply: reply,
      answered_at: new Date().toISOString(),
      user_read: false,
    })
    .eq("id", inquiryId);

  return { error: error ? "답변 등록에 실패했어요. 다시 시도해 주세요." : null };
}
