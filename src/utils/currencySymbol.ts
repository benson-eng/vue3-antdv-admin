export type Currency = {
  USD: '$'; // US Dollar
  EUR: '€'; // Euro
  CRC: '₡'; // Costa Rican Colón
  GBP: '£'; // British Pound Sterling
  ILS: '₪'; // Israeli New Sheqel
  INR: '₹'; // Indian Rupee
  JPY: '¥'; // Japanese Yen
  KRW: '₩'; // South Korean Won
  NGN: '₦'; // Nigerian Naira
  PHP: '₱'; // Philippine Peso
  PLN: 'zł'; // Polish Zloty
  PYG: '₲'; // Paraguayan Guarani
  THB: '฿'; // Thai Baht
  UAH: '₴'; // Ukrainian Hryvnia
  VND: '₫'; // Vietnamese Dong
  CNY: '￥';
  TWD: 'NT$';
  BoPound: 'B$'; // botv bo鎊
  Copper: 'C$'; // botv 銅板
};

export class CurrencySymbol {
  static symbol(currencyType: keyof Currency) {
    const currencySymbols: Currency = {
      USD: '$', // US Dollar
      EUR: '€', // Euro
      CRC: '₡', // Costa Rican Colón
      GBP: '£', // British Pound Sterling
      ILS: '₪', // Israeli New Sheqel
      INR: '₹', // Indian Rupee
      JPY: '¥', // Japanese Yen
      KRW: '₩', // South Korean Won
      NGN: '₦', // Nigerian Naira
      PHP: '₱', // Philippine Peso
      PLN: 'zł', // Polish Zloty
      PYG: '₲', // Paraguayan Guarani
      THB: '฿', // Thai Baht
      UAH: '₴', // Ukrainian Hryvnia
      VND: '₫', // Vietnamese Dong
      CNY: '￥',
      TWD: 'NT$',
      BoPound: 'B$', // botv bo鎊
      Copper: 'C$', // botv 銅板
    };

    return currencySymbols[currencyType] || '';
  }
}


