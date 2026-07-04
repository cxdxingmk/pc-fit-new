import { motherboards } from "../../database/motherboard";

export function recommendMotherboard(cpu: any) {
  const boards = motherboards.filter(
    board => board.socket === cpu.socket
  );

  return boards[0] ?? motherboards[0];
}