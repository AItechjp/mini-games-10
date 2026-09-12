export type SaunaFacility = {
  id: string;
  name: string;
  prefecture: string;
  prefectureCode: string;
  address: string;
  lat: number;
  lon: number;
  hours: string;
  hoursScope: 'sauna' | 'facility';
  website: string;
  phone: string;
  access: string;
  kind: string;
  note: string;
  sourceUrl: string;
  checkedOn: string;
};

export type SaunaSnapshot = {
  fetchedAt: string;
  sourceDate: string;
  source: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  queryComplete: boolean;
  rawCount: number;
  excludedOutsideJapan: number;
  excludedInactive: number;
  facilities: SaunaFacility[];
};

export const prefectures = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];

export const regions = [
  {name:'北海道・東北',start:0,end:7}, {name:'関東',start:7,end:14},
  {name:'北陸・甲信越',start:14,end:20}, {name:'東海',start:20,end:24},
  {name:'近畿',start:24,end:30}, {name:'中国・四国',start:30,end:39},
  {name:'九州・沖縄',start:39,end:47},
];
