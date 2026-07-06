export interface UserProfile {
  name: string;
  nickname: string;
  phone: string;
  email: string;
  profileImageDataUrl: string;
  isMarketingAgreed: boolean; // 기프티콘 이벤트 등을 위한 마케팅 수신 동의 여부
}
