const CinemaLayouts = [
  {
    "id": "dg-gt-workbook",
    "label": "东莞华南 MALL",
    "name": "东莞万达影城 · 华南 MALL",
    "format": "IMAX GT 激光厅",
    "screen": {
      "width": 28.6,
      "height": 20.73,
      "bottom": 1,
      "curve": 0.5
    },
    "aspect": 1.43,
    "firstRow": 9,
    "spacing": 1.1,
    "pitch": 0.56,
    "eyeHeight": 1.12,
    "clearance": 0.12,
    "extraClearance": 0.06,
    "width": 34.2,
    "ceiling": 25.25,
    "columns": 28,
    "capacity": 504,
    "demo": [
      "11-12",
      "11-13"
    ],
    "wood": [
      0.22,
      0.18,
      0.14
    ],
    "fabric": [
      0.19,
      0.27,
      0.224
    ],
    "screenNote": "2025 年 11 月换幕报道口径，采用 28.60 × 20.73 m。",
    "seatNote": "资料包按 21 排、每排 24 座重建，表中登记容量为 503 座。网格座号为模型编号。",
    "screenSource": "https://static.nfnews.com/content/202511/20/c11927749.html",
    "caseId": "dg-gt",
    "basis": "workbook",
    "workbookGrid": {
      "perRow": 24,
      "aisleWidth": 0.9
    },
    "seats": Array.from({ length: 21 }, () => [[24,17,1],[16,9,11],[8,1,21]])
  },
  {
    "id": "bj-sjs-workbook",
    "label": "北京石景山",
    "name": "北京万达影城 · 石景山万达广场",
    "format": "IMAX 激光厅",
    "screen": {
      "width": 23.22,
      "height": 12.68,
      "bottom": 1.3,
      "curve": 0.5
    },
    "aspect": 1.9,
    "firstRow": 12.77,
    "spacing": 1.1,
    "pitch": 0.56,
    "eyeHeight": 1.12,
    "clearance": 0.12,
    "extraClearance": 0.06,
    "width": 28.82,
    "ceiling": 16.2,
    "columns": 26,
    "capacity": 440,
    "demo": [
      "10-11",
      "10-12"
    ],
    "wood": [
      0.16,
      0.19,
      0.25
    ],
    "fabric": [
      0.18,
      0.235,
      0.31
    ],
    "screenNote": "采用工作簿所载 23.22 × 12.68 m。",
    "seatNote": "资料包按 20 排、每排 22 座重建，表中登记容量为 433 座。网格座号为模型编号。",
    "screenSource": "https://cinema.gaoliang.me/cinema/%E5%8C%97%E4%BA%AC%E4%B8%87%E8%BE%BE%E5%BD%B1%E5%9F%8E%EF%BC%88%E7%9F%B3%E6%99%AF%E5%B1%B1%E4%B8%87%E8%BE%BE%E5%B9%BF%E5%9C%BA%E5%BA%97%EF%BC%89_IMAX",
    "caseId": "bj-sjs",
    "basis": "workbook",
    "workbookGrid": {
      "perRow": 22,
      "aisleWidth": 0.9
    },
    "seats": Array.from({ length: 20 }, () => [[22,16,1],[15,9,10],[8,1,19]])
  },
  {
    "id": "hk-isq-workbook",
    "label": "香港 iSQUARE",
    "name": "香港英皇戲院 · 尖沙咀 iSQUARE",
    "format": "五院 · IMAX 激光厅",
    "screen": {
      "width": 20.94,
      "height": 11.8,
      "bottom": 1.3,
      "curve": 0.5
    },
    "aspect": 1.9,
    "firstRow": 11.52,
    "spacing": 1.1,
    "pitch": 0.56,
    "eyeHeight": 1.12,
    "clearance": 0.12,
    "extraClearance": 0.06,
    "width": 26.54,
    "ceiling": 15.5,
    "wood": [
      0.265,
      0.165,
      0.14
    ],
    "fabric": [
      0.315,
      0.178,
      0.185
    ],
    "screenNote": "采用开业报道的银幕尺寸 20.94 × 11.80 m。",
    "screenSource": "https://unwire.hk/2019/12/16/isquareimax/hottopic/walk/",
    "caseId": "hk-isq",
    "basis": "workbook",
    "demo": [
      "12-10",
      "12-11"
    ],
    "columns": 24,
    "capacity": 460,
    "workbookGrid": {
      "perRow": 20,
      "aisleWidth": 0.9
    },
    "seatNote": "资料包按 23 排、每排 20 座重建，表中登记容量为 458 座。网格座号为模型编号。",
    "seats": Array.from({ length: 23 }, () => [[20,15,1],[14,8,9],[7,1,18]])
  }
];
