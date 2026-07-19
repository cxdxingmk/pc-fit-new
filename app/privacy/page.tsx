import type { Metadata } from "next";
import { LegalDocument, LegalSection, LegalP, LegalList, LegalTable } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "PC FIT의 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="개인정보처리방침">
      <LegalP>
        PC FIT(이하 &quot;회사&quot;)은 이용자의 개인정보를 중요시하며, 「개인정보보호법」 등 관련 법령을 준수합니다.
      </LegalP>

      <LegalSection heading="1. 수집하는 개인정보 항목">
        <LegalList
          items={[
            "회원가입 시: 이메일, 비밀번호(암호화 저장), 닉네임",
            "서비스 이용 시(선택): 등록하신 PC 사양(CPU/GPU/RAM/SSD/메인보드/파워/모니터 정보), 부품·조립 사진",
            "고객센터 문의 시: 문의 내용, (로그인 상태의) 이메일",
            "자동 수집 항목: 접속 로그, 서비스 이용 기록(호스팅사가 자동으로 기록하는 접속 정보 포함)",
          ]}
        />
      </LegalSection>

      <LegalSection heading="2. 개인정보의 수집 및 이용 목적">
        <LegalList
          items={[
            "회원 식별 및 서비스 제공(로그인, PC 성능 진단·견적 계산)",
            "고객센터 문의 접수 및 답변",
            "서비스 품질 개선 및 오류 대응",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. 개인정보의 보유 및 이용 기간">
        <LegalP>
          회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기합니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. 개인정보의 처리위탁 및 국외이전">
        <LegalP>
          회사는 서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 이 과정에서 개인정보가 국외에 저장·처리될 수 있습니다.
        </LegalP>
        <LegalTable
          head={["수탁업체", "위탁업무", "저장국가"]}
          rows={[
            ["Supabase", "회원정보 및 서비스 데이터 저장·인증", "싱가포르"],
            ["Vercel", "웹사이트 호스팅", "해외(미국 등)"],
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. 이용자의 권리">
        <LegalP>
          이용자는 언제든지 자신의 개인정보를 열람, 정정, 삭제할 수 있으며, 처리 정지를 요구할 수 있습니다. 회원 탈퇴를 통해 동의를 철회할 수
          있습니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. 개인정보의 안전성 확보조치">
        <LegalList
          items={["비밀번호 암호화 저장", "데이터베이스 접근 권한 관리(이용자 본인 데이터만 접근 가능하도록 기술적 조치 적용)"]}
        />
      </LegalSection>

      <LegalSection heading="7. 쿠키의 사용">
        <LegalP>회사는 로그인 상태 유지를 위해 세션 쿠키를 사용합니다.</LegalP>
      </LegalSection>

      <LegalSection heading="8. 개인정보 보호책임자">
        <LegalList
          items={["성명: PC FIT 운영자", "이메일: 9ucci01@naver.com"]}
        />
      </LegalSection>

      <LegalSection heading="9. 고지의 의무">
        <LegalP>본 방침은 2026년 7월 20일부터 적용되며, 내용 변경 시 변경 사항을 시행 전에 공지합니다.</LegalP>
      </LegalSection>
    </LegalDocument>
  );
}
