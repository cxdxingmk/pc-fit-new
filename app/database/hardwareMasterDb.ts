export interface CpuItem {
  id: string;
  brand: 'Intel' | 'AMD';
  generation: string;
  name: string;
  socket: string;
  defaultPower: number;
}

export interface MotherboardItem {
  id: string;
  cpuBrand: 'Intel' | 'AMD';
  socket: string;
  chipsetAlpha: 'Z' | 'X' | 'B' | 'A';
  chipsetNumber: string;
  name: string;
}

export const cpuMasterDb: CpuItem[] = [
  {
    id: 'intel-core-ultra-9-285k',
    brand: 'Intel',
    generation: '인텔 코어 울트라 200S',
    name: 'Core Ultra 9 285K',
    socket: 'LGA1851',
    defaultPower: 125,
  },
  {
    id: 'intel-core-ultra-7-265k',
    brand: 'Intel',
    generation: '인텔 코어 울트라 200S',
    name: 'Core Ultra 7 265K',
    socket: 'LGA1851',
    defaultPower: 125,
  },
  {
    id: 'intel-core-ultra-5-245f',
    brand: 'Intel',
    generation: '인텔 코어 울트라 200S',
    name: 'Core Ultra 5 245F',
    socket: 'LGA1851',
    defaultPower: 125,
  },
  {
    id: 'intel-core-i9-14900k',
    brand: 'Intel',
    generation: '인텔 코어 i9 14세대',
    name: 'Core i9-14900K',
    socket: 'LGA1700',
    defaultPower: 125,
  },
  {
    id: 'intel-core-i7-14700k',
    brand: 'Intel',
    generation: '인텔 코어 i7 14세대',
    name: 'Core i7-14700K',
    socket: 'LGA1700',
    defaultPower: 125,
  },
  {
    id: 'intel-core-i5-14600k',
    brand: 'Intel',
    generation: '인텔 코어 i5 14세대',
    name: 'Core i5-14600K',
    socket: 'LGA1700',
    defaultPower: 125,
  },
  {
    id: 'intel-core-i5-14400f',
    brand: 'Intel',
    generation: '인텔 코어 i5 14세대',
    name: 'Core i5-14400F',
    socket: 'LGA1700',
    defaultPower: 65,
  },
  {
    id: 'intel-core-i3-14100f',
    brand: 'Intel',
    generation: '인텔 코어 i3 14세대',
    name: 'Core i3-14100F',
    socket: 'LGA1700',
    defaultPower: 58,
  },
  {
    id: 'amd-ryzen-9-9950x',
    brand: 'AMD',
    generation: '라이젠 9000 시리즈',
    name: 'Ryzen 9 9950X',
    socket: 'AM5',
    defaultPower: 170,
  },
  {
    id: 'amd-ryzen-9-9900x',
    brand: 'AMD',
    generation: '라이젠 9000 시리즈',
    name: 'Ryzen 9 9900X',
    socket: 'AM5',
    defaultPower: 120,
  },
  {
    id: 'amd-ryzen-7-9700x',
    brand: 'AMD',
    generation: '라이젠 9000 시리즈',
    name: 'Ryzen 7 9700X',
    socket: 'AM5',
    defaultPower: 65,
  },
  {
    id: 'amd-ryzen-5-9600x',
    brand: 'AMD',
    generation: '라이젠 9000 시리즈',
    name: 'Ryzen 5 9600X',
    socket: 'AM5',
    defaultPower: 65,
  },
  {
    id: 'amd-ryzen-7-7800x3d',
    brand: 'AMD',
    generation: '라이젠 7000 시리즈',
    name: 'Ryzen 7 7800X3D',
    socket: 'AM5',
    defaultPower: 120,
  },
  {
    id: 'amd-ryzen-7-7700',
    brand: 'AMD',
    generation: '라이젠 7000 시리즈',
    name: 'Ryzen 7 7700',
    socket: 'AM5',
    defaultPower: 65,
  },
  {
    id: 'amd-ryzen-5-7600',
    brand: 'AMD',
    generation: '라이젠 7000 시리즈',
    name: 'Ryzen 5 7600',
    socket: 'AM5',
    defaultPower: 65,
  },
  {
    id: 'amd-ryzen-5-5600',
    brand: 'AMD',
    generation: '라이젠 5000 시리즈',
    name: 'Ryzen 5 5600',
    socket: 'AM4',
    defaultPower: 65,
  },
];

export const motherboardMasterDb: MotherboardItem[] = [
  {
    id: 'intel-z890-standard',
    cpuBrand: 'Intel',
    socket: 'LGA1851',
    chipsetAlpha: 'Z',
    chipsetNumber: '890',
    name: '인텔 Z890 칩셋 표준 메인보드',
  },
  {
    id: 'intel-b860-standard',
    cpuBrand: 'Intel',
    socket: 'LGA1851',
    chipsetAlpha: 'B',
    chipsetNumber: '860',
    name: '인텔 B860 칩셋 표준 메인보드',
  },
  {
    id: 'intel-z790-standard',
    cpuBrand: 'Intel',
    socket: 'LGA1700',
    chipsetAlpha: 'Z',
    chipsetNumber: '790',
    name: '인텔 Z790 칩셋 표준 메인보드',
  },
  {
    id: 'intel-b760-standard',
    cpuBrand: 'Intel',
    socket: 'LGA1700',
    chipsetAlpha: 'B',
    chipsetNumber: '760',
    name: '인텔 B760 칩셋 표준 메인보드',
  },
  {
    id: 'intel-h610-standard',
    cpuBrand: 'Intel',
    socket: 'LGA1700',
    chipsetAlpha: 'A',
    chipsetNumber: '610',
    name: '인텔 H610 칩셋 표준 메인보드',
  },
  {
    id: 'amd-x870-standard',
    cpuBrand: 'AMD',
    socket: 'AM5',
    chipsetAlpha: 'X',
    chipsetNumber: '870',
    name: 'AMD X870 칩셋 표준 메인보드',
  },
  {
    id: 'amd-b650-standard',
    cpuBrand: 'AMD',
    socket: 'AM5',
    chipsetAlpha: 'B',
    chipsetNumber: '650',
    name: 'AMD B650 칩셋 표준 메인보드',
  },
  {
    id: 'amd-a620-standard',
    cpuBrand: 'AMD',
    socket: 'AM5',
    chipsetAlpha: 'A',
    chipsetNumber: '620',
    name: 'AMD A620 칩셋 표준 메인보드',
  },
  {
    id: 'amd-x670-standard',
    cpuBrand: 'AMD',
    socket: 'AM5',
    chipsetAlpha: 'X',
    chipsetNumber: '670',
    name: 'AMD X670 칩셋 표준 메인보드',
  },
  {
    id: 'amd-b550-standard',
    cpuBrand: 'AMD',
    socket: 'AM4',
    chipsetAlpha: 'B',
    chipsetNumber: '550',
    name: 'AMD B550 칩셋 표준 메인보드',
  },
  {
    id: 'amd-a520-standard',
    cpuBrand: 'AMD',
    socket: 'AM4',
    chipsetAlpha: 'A',
    chipsetNumber: '520',
    name: 'AMD A520 칩셋 표준 메인보드',
  },
];

export const hardwareMasterDb = {
  cpus: cpuMasterDb,
  motherboards: motherboardMasterDb,
};
