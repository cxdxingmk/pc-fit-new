# pc-fit-new

PC 부품 추천과 시스템 분석을 돕는 Next.js 기반 웹 애플리케이션입니다.

## 핵심 기능

- PC 부품 추천 및 호환성 분석
- 사용자 PC 정보 기반 점수화 및 비교
- 대시보드, 분석, 지원 페이지 제공

## 사용 기술

- Next.js
- TypeScript
- React
- Tailwind CSS

## 실행

```bash
npm install
npm run dev
```

## 관리자 계정 설정

관리자 지정 UI는 없습니다(의도적). 본인 계정을 관리자로 만드는 방법:

Supabase Table Editor → `profiles` 테이블 → 본인 행 찾아 `is_admin`을 `true`로 변경.

관리자로 지정되면 헤더 프로필 메뉴에 "🛠️ 관리자" 링크가 나타나며, `/admin/support`에서 고객센터 문의에 답변할 수 있습니다.
