import type { Metadata } from "next";
import { LegalDocument, LegalSection, LegalP, LegalList, LegalPlaceholder } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "이용약관",
  description: "PC FIT의 이용약관",
};

export default function TermsPage() {
  return (
    <LegalDocument title="이용약관">
      <LegalSection heading="제1조 (목적)">
        <LegalP>
          본 약관은 PC FIT(이하 &quot;회사&quot;)이 제공하는 PC 성능 진단·견적 추천 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차,
          회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="제2조 (서비스의 내용)">
        <LegalP>
          회사는 이용자가 입력하거나 자동으로 인식된 PC 사양을 기반으로 게임·작업 성능을 추정하여 제공하며, 부품을 직접 판매하지 않습니다.
          제공되는 성능 예측치는 통계 모델 기반 추정으로, 실제 성능과 다를 수 있습니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="제3조 (회원가입)">
        <LegalP>
          이용자는 이메일, 비밀번호, 닉네임을 입력하여 회원가입을 신청하며, 회사가 이를 승낙함으로써 회원가입이 완료됩니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="제4조 (회원의 의무)">
        <LegalP>이용자는 다음 행위를 하여서는 안 됩니다.</LegalP>
        <LegalList
          items={["타인의 정보를 도용하는 행위", "서비스 운영을 방해하는 행위", "서비스를 이용해 수집한 정보를 상업적으로 무단 이용하는 행위"]}
        />
      </LegalSection>

      <LegalSection heading="제5조 (서비스 이용의 제한 및 중단)">
        <LegalP>회사는 시스템 점검, 장애 등의 사유로 서비스 제공을 일시적으로 중단할 수 있습니다.</LegalP>
      </LegalSection>

      <LegalSection heading="제6조 (면책조항)">
        <LegalP>
          회사가 제공하는 성능 예측·견적 정보는 참고용이며, 실제 구매·조립 결과에 대해 회사는 책임을 지지 않습니다.
        </LegalP>
      </LegalSection>

      <LegalSection heading="제7조 (분쟁해결)">
        <LegalP>본 약관과 관련한 분쟁은 대한민국 법령에 따르며, 관할 법원은 민사소송법에 따른 관할 법원으로 합니다.</LegalP>
      </LegalSection>

      <LegalSection heading="부칙">
        <LegalP>
          본 약관은 <LegalPlaceholder>시행일자</LegalPlaceholder>부터 시행합니다.
        </LegalP>
      </LegalSection>
    </LegalDocument>
  );
}
