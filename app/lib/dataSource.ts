import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

// Local implementation: read from root-level database/* files.
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";

export type DataSourceType = "local" | "db";

export class DataSource {
  private type: DataSourceType;

  constructor(type: DataSourceType = "local") {
    this.type = type;
  }

  // CPU
  async getCpuData(): Promise<CPU[]> {
    // local implementation
    return cpus;
  }

  // GPU
  async getGpuData(): Promise<GPU[]> {
    return gpus;
  }

  // RAM
  async getRamData(): Promise<RAM[]> {
    return rams;
  }

  // SSD
  async getSsdData(): Promise<SSD[]> {
    return ssds;
  }

  // Motherboard
  async getMotherboardData(): Promise<MotherBoard[]> {
    return motherboards;
  }

  // PSU
  async getPsuData(): Promise<PSU[]> {
    return psus;
  }

}

export const defaultDataSource = new DataSource("local");
