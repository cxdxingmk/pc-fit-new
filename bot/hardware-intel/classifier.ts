import type { ClassificationRule, ClassifiedArticle, HardwareCategory, PartStatus, RawFeedItem } from "./types.ts";
import { nowIso, sha256, truncate } from "./util.ts";

export class ArticleClassifier {
  // 우선순위가 낮은 숫자일수록 먼저 매칭됨 — 새로운 카테고리는 규칙 push만으로 확장 가능
  private readonly rules: ClassificationRule[] = [
    {
      category: "ISSUE_REPORT",
      priority: 1,
      patterns: [
        /\b(defect|faulty|failure|failing|dying|dead on arrival|DOA|recall|melting|melt|crack|artifact(?:ing)?|instability|crash(?:es|ing)? report|RMA)\b/i,
        /\b(reddit|community) (?:reports?|complaints?)\b/i,
        /초기\s*불량|이슈\s*리포트/i,
      ],
    },
    {
      category: "POWER_THERMAL",
      priority: 2,
      patterns: [
        /\b(power (?:consumption|draw|efficiency)|watt(?:age)?|TDP|TGP|thermal(?:s)?|temperature(?:s)?|cooling test|heat output)\b/i,
        /전력\s*소비|발열/i,
      ],
    },
    {
      category: "DRIVER_UPDATE",
      priority: 3,
      patterns: [
        /\b(driver(?:s)?\s*(?:update|release|version)?|GeForce (?:Game Ready|driver)|Adrenalin|Radeon Software|Intel (?:Arc|Graphics) driver|WHQL)\b/i,
      ],
    },
    {
      category: "BIOS_FIRMWARE",
      priority: 4,
      patterns: [/\b(BIOS|UEFI|firmware|AGESA|microcode|ME firmware)\b/i],
    },
    {
      category: "GAME_OPTIMIZATION",
      priority: 5,
      patterns: [/\b(DLSS|FSR|XeSS|frame generation|ray tracing patch|game (?:patch|update|optimization)|performance patch)\b/i],
    },
    {
      category: "GPU",
      priority: 6,
      patterns: [/\b(GPU|graphics card|GeForce|RTX\s?\d{3,4}|GTX\s?\d{3,4}|Radeon|RX\s?\d{3,4}|Arc\s?[AB]\d{3}|video card)\b/i],
    },
    {
      category: "CPU",
      priority: 7,
      patterns: [
        /\b(CPU|processor|Ryzen|Threadripper|EPYC|Core\s?(?:i[3579]|Ultra)|Xeon|Zen\s?\d|Arrow Lake|Raptor Lake|Meteor Lake|Lunar Lake|Granite Rapids)\b/i,
      ],
    },
    {
      category: "SSD",
      priority: 8,
      patterns: [/\b(SSD|NVMe|M\.2|PCIe (?:4|5)\.0 (?:SSD|drive)|NAND|solid[- ]state)\b/i],
    },
    {
      category: "RAM",
      priority: 9,
      patterns: [/\b(RAM|DDR[45]|memory kit|DIMM|SO-DIMM|CUDIMM|memory module|CAMM2?)\b/i],
    },
    {
      category: "MAINBOARD",
      priority: 10,
      patterns: [/\b(motherboard|mainboard|mobo|chipset|[XBZ]\d{3}[E]?\s?(?:chipset|board)?|LGA\s?\d{4}|AM[45]\s?socket)\b/i],
    },
  ];

  private readonly perfPatterns: RegExp[] = [
    /(?:up to|by|gains? of|improvement of|boost(?:s|ed)? (?:of|by)?|faster by|increase(?:s|d)? (?:of|by)?)\s*(\d{1,3}(?:\.\d+)?)\s*%/i,
    /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:faster|improvement|performance (?:uplift|gain|boost|increase)|uplift|higher fps|more performance)/i,
    /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:향상|개선|상승)/,
  ];

  private readonly partNamePatterns: RegExp[] = [
    /\b(RTX\s?\d{4}\s?(?:Ti|SUPER)?(?:\s?\d{1,2}GB)?)\b/i,
    /\b(RX\s?\d{4}\s?(?:XTX?|GRE)?)\b/i,
    /\b(Arc\s?[AB]\d{3})\b/i,
    /\b(Ryzen\s?\d?\s?\d{4}[A-Z0-9]{0,3}(?:X3D|X|G|HX|HS)?)\b/i,
    /\b(Core\s?Ultra\s?[579]\s?\d{3}[A-Z]{0,2})\b/i,
    /\b(Core\s?i[3579][- ]\d{4,5}[A-Z]{0,2})\b/i,
    /\b(Threadripper\s?(?:PRO\s?)?\d{4}[A-Z]{0,3})\b/i,
    /\b(EPYC\s?\d{4}[A-Z]?)\b/i,
  ];

  private readonly releasedPatterns: RegExp[] = [
    /\b(now available|launched|launches today|on sale|released|goes on sale|hits (?:the )?(?:shelves|retail)|availability|출시)\b/i,
  ];
  private readonly announcedPatterns: RegExp[] = [
    /\b(announce(?:s|d)?|unveil(?:s|ed)?|teas(?:es|ed)|preview|leak(?:s|ed)?|rumor(?:ed)?|spotted|specifications surface|발표)\b/i,
  ];

  classify(item: RawFeedItem): ClassifiedArticle {
    const corpus = `${item.title} ${item.description}`;

    let category: HardwareCategory = "GENERAL";
    const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);
    for (const rule of sorted) {
      if (rule.patterns.some((p) => p.test(corpus))) {
        category = rule.category;
        break;
      }
    }

    let perfGainPercent: number | null = null;
    for (const pattern of this.perfPatterns) {
      const match = corpus.match(pattern);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (Number.isFinite(value) && value > 0 && value <= 500) {
          perfGainPercent = value;
          break;
        }
      }
    }

    let detectedPartName: string | null = null;
    for (const pattern of this.partNamePatterns) {
      const match = corpus.match(pattern);
      if (match && match[1]) {
        detectedPartName = match[1].replace(/\s+/g, " ").trim().toUpperCase();
        break;
      }
    }

    let detectedStatus: PartStatus | null = null;
    if (this.releasedPatterns.some((p) => p.test(corpus))) {
      detectedStatus = "RELEASED";
    } else if (this.announcedPatterns.some((p) => p.test(corpus))) {
      detectedStatus = "ANNOUNCED";
    }

    const summarySource = item.description || item.title;
    const summary = truncate(summarySource, 220);

    return {
      urlHash: sha256(item.link),
      title: truncate(item.title, 300),
      link: item.link,
      summary,
      category,
      perfGainPercent,
      detectedPartName,
      detectedStatus,
      sourceName: item.sourceName,
      publishedAt: item.pubDate,
      collectedAt: nowIso(),
    };
  }
}
