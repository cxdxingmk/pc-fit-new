// 비밀번호가 바뀌면(본인이 아닌 제3자가 바꿨을 가능성에 대비해) 등록된 이메일로 보안 알림을
// 보낸다. 이 프로젝트엔 아직 SMTP/이메일 발송 인프라(Resend, SES 등)가 연결돼 있지 않아, 지금은
// 실제 발송 없이 구조와 호출 지점만 만들어 둔다 — 인프라가 붙으면 이 함수 내부만 바꾸면 된다.
//
// TODO(이메일 인프라 연동 후 활성화): 아래를 실제 발송 API 호출로 교체한다.
//   예) Resend: await resend.emails.send({ from, to: email, subject, html })
//   실패해도 비밀번호 변경 자체는 이미 완료된 뒤이므로, 호출부(app/mypage/profile/actions.ts)는
//   이 함수의 실패를 절대 사용자에게 노출하지 않고 로그로만 남긴다.
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  console.info(`[sendPasswordChangedEmail] STUB — 실제 발송 없음. 대상: ${email}`);
}
