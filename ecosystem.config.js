/**
 * PM2 프로세스 설정 — 하드웨어 인텔 봇(bot/hardware-intel) 24시간 상주 운영용.
 * PC FIT 웹앱(Next.js)과는 완전히 별개 프로세스로 관리한다.
 *
 * 사용법:
 *   npm run bot:start    (최초 기동)
 *   npm run bot:logs     (로그 확인)
 *   npm run bot:restart  (코드 변경 후 재기동)
 *   npm run bot:stop
 *
 * Windows 부팅 시 자동 기동(선택):
 *   PM2 공식 `pm2 startup`은 Linux systemd/launchd 전제라 Windows에서 그대로 동작하지 않는다.
 *   Windows에서는 `pm2-windows-startup` 패키지를 별도로 설치해 사용해야 한다(수동 설치 필요):
 *     npm i -g pm2-windows-startup && pm2-startup install
 *   그 후 `npm run bot:start` && `pm2 save`를 한 번 실행해두면 재부팅 후에도 자동 기동된다.
 */
module.exports = {
  apps: [
    {
      name: "hardware-intel-bot",
      script: "bot/hardware-intel/index.ts",
      interpreter: "node", // Node 24 네이티브 TS 실행 사용 — ts-node/빌드 스텝 불필요
      cwd: __dirname,
      watch: false, // 코드 변경 시 자동 재시작은 원치 않음(수동 npm run bot:restart로 제어)
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: "30s",
      out_file: "./logs/hardware-intel-bot.out.log",
      error_file: "./logs/hardware-intel-bot.err.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
