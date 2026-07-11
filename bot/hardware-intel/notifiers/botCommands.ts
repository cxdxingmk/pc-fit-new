/** Discord/Telegram 봇이 공통으로 위임하는 명령 콜백 묶음 — orchestrator.ts가 구현을 채워 넣는다. */
export interface BotCommands {
  onUpdate: () => Promise<string>;
  onBriefing: () => Promise<string>;
  onProposals: () => Promise<string>;
  onProposalDetail: (id: number) => Promise<string>;
  onApprove: (id: number, decidedBy: string) => Promise<string>;
  onReject: (id: number, decidedBy: string, reason: string | null) => Promise<string>;
  onExportApproved: () => Promise<string>;
  onMarkApplied: (ids: number[], markedBy: string) => Promise<string>;
}
