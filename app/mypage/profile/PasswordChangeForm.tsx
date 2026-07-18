"use client";

import { useActionState, useEffect, useId, useState } from "react";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  isValidPassword,
  PASSWORD_RULE_HINT,
  PASSWORD_RULE_ERROR,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_MATCH_MESSAGE,
} from "@/app/lib/passwordRule";
import { getPasswordStrength, type PasswordStrengthLevel } from "@/app/lib/passwordStrength";
import { changePassword } from "./actions";
import { PrimaryButton } from "@/app/components/pcfit-ui";

const STRENGTH_BAR_CLASS: Record<PasswordStrengthLevel, string> = {
  weak: "w-1/3 bg-rose-500",
  fair: "w-2/3 bg-amber-400",
  strong: "w-full bg-emerald-400",
};

const STRENGTH_LABEL_CLASS: Record<PasswordStrengthLevel, string> = {
  weak: "text-rose-400",
  fair: "text-amber-400",
  strong: "text-emerald-400",
};

interface PasswordChangeFormProps {
  /** 변경 성공 "직후"(완료 화면이 뜨는 시점)에 호출 — 부모가 토스트를 띄우는 용도. */
  onSuccess?: () => void;
  /** 완료 화면의 "닫기" 버튼을 눌렀을 때 호출 — 부모가 섹션 자체를 접는 용도. */
  onDismiss?: () => void;
}

export default function PasswordChangeForm({ onSuccess, onDismiss }: PasswordChangeFormProps) {
  const [state, formAction, pending] = useActionState(changePassword, undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPasswordBlurred, setNewPasswordBlurred] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);

  const currentPasswordId = useId();
  const newPasswordId = useId();
  const newPasswordHintId = useId();
  const newPasswordConfirmId = useId();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- onSuccess는 부모가 매 렌더 새로
  // 만들어 넘길 수 있어 의도적으로 의존성에서 뺐다(state가 바뀔 때만 반응하면 충분하다).
  useEffect(() => {
    if (state?.success) {
      setJustSucceeded(true);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      onSuccess?.();
    }
  }, [state]);

  const strength = getPasswordStrength(newPassword);
  const newPasswordRuleValid = isValidPassword(newPassword);
  const showRuleError = newPasswordBlurred && newPassword.length > 0 && !newPasswordRuleValid;

  const confirmFilled = newPasswordConfirm.length > 0;
  const passwordsMatch = newPassword === newPasswordConfirm;
  const showMismatch = confirmFilled && !passwordsMatch;

  const submitDisabled = pending || currentPassword.length === 0 || !newPasswordRuleValid || !confirmFilled || !passwordsMatch;

  if (justSucceeded) {
    return (
      <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
        <p className="text-lg font-bold text-emerald-300">비밀번호 변경 완료</p>
        <p className="mt-2 text-sm text-emerald-100/80">
          새 비밀번호로 안전하게 변경됐어요. 다른 기기에 로그인돼 있던 세션은 모두 로그아웃 처리했어요.
        </p>
        <button
          type="button"
          onClick={() => {
            setJustSucceeded(false);
            onDismiss?.();
          }}
          className="mt-5 rounded-2xl bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="text-sm font-semibold text-white/70">
        <label htmlFor={currentPasswordId}>현재 비밀번호</label>
        <PasswordInput
          id={currentPasswordId}
          name="currentPassword"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          placeholder="현재 비밀번호를 입력하세요"
        />
      </div>

      <div className="text-sm font-semibold text-white/70">
        <label htmlFor={newPasswordId}>새 비밀번호</label>
        <PasswordInput
          id={newPasswordId}
          name="newPassword"
          value={newPassword}
          onChange={setNewPassword}
          onBlur={() => setNewPasswordBlurred(true)}
          autoComplete="new-password"
          placeholder="8자 이상, 영문+숫자 포함"
          ariaDescribedBy={newPasswordHintId}
          ariaInvalid={showRuleError}
        />
        {showRuleError ? (
          <p id={newPasswordHintId} className="mt-1.5 text-xs text-rose-400">
            {PASSWORD_RULE_ERROR}
          </p>
        ) : (
          <p id={newPasswordHintId} className="mt-1.5 text-xs text-white/35">
            {PASSWORD_RULE_HINT}
          </p>
        )}

        {newPassword.length > 0 ? (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full transition-all ${STRENGTH_BAR_CLASS[strength.level]}`} />
            </div>
            <p className={`mt-1 text-xs font-semibold ${STRENGTH_LABEL_CLASS[strength.level]}`}>비밀번호 강도: {strength.label}</p>
          </div>
        ) : null}
      </div>

      <div className="text-sm font-semibold text-white/70">
        <label htmlFor={newPasswordConfirmId}>새 비밀번호 확인</label>
        <PasswordInput
          id={newPasswordConfirmId}
          name="newPasswordConfirm"
          value={newPasswordConfirm}
          onChange={setNewPasswordConfirm}
          autoComplete="new-password"
          placeholder="새 비밀번호를 한 번 더 입력하세요"
          ariaInvalid={showMismatch}
        />
        {confirmFilled ? (
          <p role="status" className={`mt-1.5 text-xs ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}>
            {passwordsMatch ? PASSWORD_MATCH_MESSAGE : PASSWORD_MISMATCH_MESSAGE}
          </p>
        ) : null}
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/25">
          {state.error}
        </p>
      ) : null}

      <PrimaryButton type="submit" full disabled={submitDisabled}>
        {pending ? "변경 중..." : "비밀번호 변경"}
      </PrimaryButton>
    </form>
  );
}
