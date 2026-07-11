# Hardware Intel Bot

RSS 기반 하드웨어 뉴스 수집·분류 봇 + PC FIT 카탈로그(`app/database/*.ts`)에 대한 "AI 비서" 제안 워크플로우.
PC FIT 웹앱(Next.js)과는 **완전히 분리된 별도 서버에 배포될 수 있는** 독립 Node 프로세스로 동작한다
(실제로 현재 봇은 101.79.8.203, 웹앱은 아직 배포 위치 미정 — 이 봇은 웹앱 소스가 어디에 있든
동작하도록 설계되어 있다. 아래 "아키텍처" 항목 참고).

## 환경변수

`.env.example`를 `.env`로 복사 후 채운다:

```
DISCORD_BOT_TOKEN=
DISCORD_CHANNEL_ID=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
HARDWARE_INTEL_DB_PATH=   # 선택, 기본값 hardware_intel.db(프로세스 실행 경로 기준)
```

## 실행

```
npm run bot:start     # PM2로 상주 기동
npm run bot:status    # 상태 확인
npm run bot:logs      # 로그 스트리밍
npm run bot:restart   # 코드 변경 후 재기동
npm run bot:stop

npm run bot:hardware-intel   # PM2 없이 포그라운드 실행(디버깅용)
```

## 아키텍처 — 봇과 웹앱은 서로의 파일시스템을 공유하지 않는다

`bot/hardware-intel`은 이 저장소(`pc-fit-new`) 안에 있지만, **배포된 봇 프로세스가 실제로 도는
서버에 웹앱 소스(`app/database`, `app/lib`, `src/` 등)가 함께 있으리라고 가정하지 않는다.**
봇 서버와 웹앱은 다른 서버일 수도, 웹앱이 아직 어디에도 배포 안 됐을 수도 있다(현재 상태).
그래서 카탈로그를 "읽는" 것과 "쓰는" 것 모두 **파일 하나를 수동으로 주고받는 방식**으로
분리되어 있다 — 어느 쪽이 먼저 배포되든, 나중에 어디로 옮기든 코드를 바꿀 필요가 없다.

```
[로컬 개발 환경 — 이 저장소가 실제로 있는 곳, app/database 소스의 원본]

  npm run export-catalog-snapshot
        │
        ▼
  bot/hardware-intel/data/catalog-snapshot.json  (생성물, git에 안 올라감)
        │
        │  (scp로 수동 복사)
        ▼
[봇 서버 — 예: 101.79.8.203]

  bot/hardware-intel/data/catalog-snapshot.json 를 읽어서
  matcher.ts가 부품명 매칭(정확/유사/신규)에 사용
        │
        │ 주간 cron → proposals 테이블에 pending 적재 → 사람이 !approve
        ▼
  proposals(status='approved') 중 SPEC_UPDATE만
        │
        │  !export-approved  →  JSON을 Discord/Telegram 메시지로 출력
        ▼
[로컬 개발 환경 (또는 앞으로 웹앱 소스가 있게 될 곳)]

  받은 JSON을 파일로 저장 → npm run apply-proposals -- <파일>
        │  (ts-morph로 app/database/*.ts AST 수정 + tsc --noEmit 즉시 검증 + 실패 시 롤백)
        ▼
  git diff로 확인 → 커밋 → (평소 배포 방식대로) 배포
        │
        │  !mark-applied <id...>  →  봇 쪽 proposals를 applied로 닫음(중복 재내보내기 방지)
        ▼
[봇 서버]
```

이 흐름 덕분에 봇은 카탈로그 파일에 **절대 직접 쓰지 않는다** — 실제 AST 수정은 항상 웹앱
소스가 있는 곳(지금은 로컬 개발 환경)에서, 사람이 `npm run apply-proposals`를 실행할 때만
일어난다. 네트워크 연결도, 공유 파일시스템도, 배포 위치에 대한 사전 결정도 필요 없다.

카탈로그가 바뀌었으면(신제품 추가, 카탈로그 데이터 수정 등) `npm run export-catalog-snapshot`을
다시 실행해 스냅샷을 갱신하고 봇 서버로 재복사해야 매칭 정확도가 유지된다(스냅샷이 오래되면
`!proposals`/브리핑에는 안 뜨지만 로그에 "N일 전 것" 경고가 남는다 — 14일 기준).

## 명령어

| Discord | Telegram | 동작 |
|---|---|---|
| `!update` | `/update` | 즉시 RSS 수집 사이클 실행 |
| `!briefing` | `/briefing` | 미브리핑 데이터 요약 발송 |
| `!proposals` | `/proposals` | 대기 중인 제안 목록 |
| `!proposal <id>` | `/proposal <id>` | 제안 상세(변경 전/후 diff) |
| `!approve <id>` | `/approve <id>` | 승인(카탈로그 자동 반영은 하지 않음, 아래 참고) |
| `!reject <id> [사유]` | `/reject <id> [사유]` | 거절, 사유 기록 |
| `!export-approved` | `/export_approved` | 승인된 SPEC_UPDATE를 JSON으로 내보내기 |
| `!mark-applied <id...>` | `/mark_applied <id...>` | 로컬에서 반영 완료 후 봇 쪽 상태를 닫기 |

(Telegram은 명령어에 하이픈을 못 써서 `export_approved`/`mark_applied`로 언더스코어 사용.)

자동 스케줄(KST): 수집 매 30분 / 일일 브리핑 09:00(대기 중인 제안 목록 포함) / 주간 마스터
동기화·제안 생성 월 09:05.

## AI 비서 — 카탈로그 제안 승인 워크플로우

봇은 **절대로 카탈로그를 자동 수정하지 않는다.** 매주 월요일 동기화 시 RSS에서 감지한 부품명을
카탈로그 스냅샷과 매칭해 `proposals` 테이블에 `pending` 상태로만 쌓고, 사람이 승인/거절해야
다음 단계로 넘어간다.

### 제안 3종과 실제 반영 범위

- **SPEC_UPDATE** (기존 카탈로그 항목의 gameScore/workScore/aiScore 갱신) — 유일하게 실제로
  자동 반영 가능한 종류. 승인 후 `!export-approved` → 로컬에서 `npm run apply-proposals` →
  `!mark-applied`의 3단계를 거친다.
- **NEW_PART** / **STATUS_CHANGE** (신규 부품 감지 / 발표→출시 전환) — RSS에는 코어 수·클럭·
  gameScore 등 카탈로그가 요구하는 전체 스펙이 없어 자동으로 온전한 카탈로그 항목을 만들 수
  없다. 승인해도 내보내기 대상이 되지 않고, 제안 상세(`!proposal <id>`)에 담긴 감지된 이름/
  유사 후보/근거 기사를 보고 사람이 직접 `app/database/*.ts`에 추가해야 한다.

### 매칭 학습

한 번 승인되어 카탈로그 대상이 확정된 표기는 `part_aliases` 테이블에 누적 저장된다. 같은 표기가
다음에 또 나오면 매칭 재추론 없이 즉시 재사용된다.

### 알려진 제약

- 가격 데이터는 이번 범위에서 제외(RSS 자체에 가격 정보 없음).
- PSU는 `classifier.ts`에 전용 분류 규칙이 없어 현재 자동 제안 대상이 아니다.
- 카탈로그 스냅샷은 수동 갱신이 필요하다(자동 동기화 없음) — 웹앱과 봇이 같은 서버로 합쳐지면
  다시 파일 직접 참조 방식으로 단순화할 수 있다(아래 배포 아키텍처 참고).
- 주간 제안 생성 개수는 상한(기본 20건)이 있다 — 초과분은 다음 주에 재평가된다.

## 웹앱 배포 아키텍처 — 봇과의 연동을 고려한 선택지

웹앱을 어디에 배포하든 위 export/apply 흐름은 그대로 동작하므로 급하게 결정할 필요는 없다.
다만 참고로 트레이드오프를 정리하면:

**A. 같은 서버(101.79.8.203)에 웹앱도 배포, PM2로 함께 관리**
같은 VM에 `/root/pc-fit-new`(웹앱)와 `/root/bot`을 나란히 두는 방식. 서버 하나만 관리하면 되고,
같은 파일시스템이 되는 순간 이 문서의 export/apply 수동 단계를 다시 "봇이 app/database를 직접
읽고 쓰는" 방식으로 되돌려 자동화할 수도 있다(예전 catalogWriter.ts 방식, 필요해지면 git
히스토리에서 복원 가능). 소규모 개인 프로젝트에는 가장 단순하고 운영 부담이 적은 선택.

**B. Vercel(또는 유사 매니지드 호스팅)에 웹앱 배포, 봇은 지금 서버 그대로**
Next.js 배포에는 사실상 최적화된 선택(무료/저렴, 자동 HTTPS, git push로 배포). 다만 Vercel은
런타임에 파일을 써서 영구 저장할 수 없으므로 "봇이 웹앱 서버에 직접 쓰기"는 애초에 불가능 —
지금 설계한 "로컬(개발 머신)에서 apply-proposals 실행 후 git commit/push" 흐름이 오히려 Vercel과
자연스럽게 맞는다(어차피 평소에도 로컬에서 코드 고치고 push해서 배포하는 흐름이므로). 이 경우
지금의 수동 export/apply 방식을 유지하는 게 정답에 가깝다 — 굳이 봇-웹앱 간 API를 새로 만들
필요가 없다.

**추천**: 지금 당장은 B(또는 A든 상관없이) 어느 쪽을 택해도 이 문서의 워크플로우가 그대로
작동하니, 배포 위치 결정을 미루고 우선 급한 다른 작업을 진행해도 된다. 다만 나중에 "제안이
쌓일 때마다 매번 수동 export/apply 하기 귀찮다" 싶어지면, 그때는 A를 택해 같은 서버로 합치고
봇이 다시 파일을 직접 참조하도록 되돌리는 게 가장 적은 작업으로 자동화를 얻는 길이다.

## 장애 대응 체크리스트

1. `npm run bot:status` — 프로세스가 살아있는지 확인.
2. `npm run bot:logs` (또는 `logs/hardware-intel-bot.{out,err}.log`) — 최근 에러 확인.
3. Discord/Telegram 발송 실패는 대부분 토큰 만료/미설정 — `.env` 재확인 후 `npm run bot:restart`.
4. **명령어를 쳤는데 로그에 아무 흔적도 없고 응답도 없다면** — 십중팔구 배포된 코드가
   최신이 아니다. `notifiers/discordBot.ts`의 `handleMessage`에 해당 명령 분기가 실제로
   있는지, 파일 수정 시각(`ls -la --time-style=full-iso`)이 최근 배포와 맞는지 확인하고,
   맞지 않으면 `bot/hardware-intel` 전체 + 루트의 `ecosystem.config.js`/`package.json`/
   `scripts/tsconfig.cjs.json`을 다시 복사한 뒤 `npm install` + `npm run bot:restart`.
5. `!export-approved`가 빈 목록만 보인다면 승인된(approved, 아직 applied 아닌) SPEC_UPDATE가
   없는 것 — `!proposals`로 대기 목록부터 확인.
6. `npm run apply-proposals`가 실패하면 로그에 `tsc 검증 실패로 롤백함`이 있는지 확인 —
   있으면 파일은 이미 자동으로 원상 복구된 상태(`git diff app/database/`로 확인 가능).
7. `hardware_intel.db`(SQLite)가 손상 의심되면 프로세스 정지 후 파일을 백업하고 재기동(WAL 모드라
   `.db-wal`/`.db-shm` 동반 파일이 있을 수 있음).
