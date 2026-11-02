'use strict';
/* =========================================================
   Данные: типы жилья, удобства и 16 домов посёлка.
   Цены в рублях за ночь.
   ========================================================= */

// Типы загородного жилья (значение — подпись в фильтре)
const TYPES = {
  log: 'Бревенчатый дом',
  chalet: 'Шале',
  aframe: 'А-фрейм',
  barn: 'Барнхаус',
  dome: 'Купол (глэмпинг)',
  modern: 'Современный дом'
};

// Удобства: подпись и иконка из спрайта в index.html
const AMENITIES = {
  tv: { label: 'Телевизор', icon: 'i-tv' },
  access: { label: 'Доступная среда', icon: 'i-access' },
  woods: { label: 'В лесу', icon: 'i-woods' },
  hottub: { label: 'Купель', icon: 'i-bath' },
  views: { label: 'Красивый вид', icon: 'i-eye' },
  water: { label: 'Озеро / река', icon: 'i-waves' },
  fireplace: { label: 'Камин', icon: 'i-fire' },
  pets: { label: 'С животными', icon: 'i-paw' },
  wifi: { label: 'Wi-Fi', icon: 'i-wifi' },
  sauna: { label: 'Баня', icon: 'i-tub' }
};

/* Поля дома:
   x, y      — положение на схеме в процентах
   occupied  — дом занят целиком (бронь другого гостя)
   busy      — занятые ночи других гостей: [через сколько дней от сегодня, сколько ночей]
   mood      — время суток/сезон картинки: day | dusk | night | autumn | winter
   wood/roof — цвета стен и крыши на картинке
   photo     — путь к своему фото (например 'img/house-1.jpg'); пусто = рисунок
   added     — «новизна» для сортировки */
const HOUSES = [
  { id: 1, name: 'Лесная сказка', place: 'Сортавала, Карелия', type: 'log', price: 6500, capacity: 6,
    amenities: ['woods', 'fireplace', 'sauna', 'wifi', 'pets'], x: 12, y: 18, mood: 'day', wood: '#a8744a', roof: '#4a3a34',
    added: 3, busy: [[5, 3], [16, 4]], occupied: false, photo: '',
    desc: 'Просторный бревенчатый дом среди сосен. Камин, русская баня и мангальная зона во дворе.' },
  { id: 2, name: 'Берег Ладоги', place: 'Приозерск, Ленинградская обл.', type: 'modern', price: 12800, capacity: 4,
    amenities: ['water', 'views', 'wifi', 'hottub', 'tv'], x: 24, y: 36, mood: 'dusk', wood: '#d8d3ca', roof: '#2c3033',
    added: 9, busy: [[3, 2], [10, 5]], occupied: false, photo: '',
    desc: 'Дом с панорамными окнами прямо у воды. Купель на террасе и тихий закат над озером.' },
  { id: 3, name: 'Шишка', place: 'Рускеала, Карелия', type: 'aframe', price: 7400, capacity: 3,
    amenities: ['woods', 'fireplace', 'wifi', 'hottub'], x: 31, y: 25, mood: 'night', wood: '#b08358', roof: '#2d2f36',
    added: 16, busy: [[7, 3]], occupied: false, photo: '',
    desc: 'Уютный А-фрейм со стеклянным фасадом: ночью видно звёзды. Подойдёт для пары или небольшой семьи.' },
  { id: 4, name: 'Мельница', place: 'Руза, Подмосковье', type: 'barn', price: 9200, capacity: 8,
    amenities: ['tv', 'wifi', 'fireplace', 'sauna', 'pets', 'access'], x: 34, y: 29, mood: 'day', wood: '#8a6a4c', roof: '#5b6168',
    added: 1, busy: [], occupied: true, photo: '',
    desc: 'Барнхаус для компании: большая гостиная с камином, баня и пространство для праздника.' },
  { id: 5, name: 'Белая сова', place: 'Валдай, Новгородская обл.', type: 'chalet', price: 11500, capacity: 6,
    amenities: ['views', 'fireplace', 'hottub', 'wifi', 'woods'], x: 46, y: 14, mood: 'winter', wood: '#8c5e3c', roof: '#3b3f46',
    added: 12, busy: [[2, 4], [20, 3]], occupied: false, photo: '',
    desc: 'Шале с видом на заснеженный лес. Вечером горит камин, а на террасе ждёт горячая купель.' },
  { id: 6, name: 'Звёздный', place: 'Выборг, Ленинградская обл.', type: 'dome', price: 8800, capacity: 4,
    amenities: ['views', 'wifi', 'woods'], x: 58, y: 30, mood: 'night', wood: '#a47b52', roof: '#3a3d44',
    added: 7, busy: [[6, 2]], occupied: false, photo: '',
    desc: 'Купол-глэмпинг с прозрачной стеной и тёплым полом. Тишина, лес и много звёзд.' },
  { id: 7, name: 'Сосновый бор', place: 'Таруса, Калужская обл.', type: 'log', price: 5900, capacity: 5,
    amenities: ['woods', 'sauna', 'pets', 'fireplace'], x: 62, y: 49, mood: 'autumn', wood: '#9b6a3f', roof: '#55403a',
    added: 14, busy: [[9, 4]], occupied: false, photo: '',
    desc: 'Тёплый дом в сосновом бору. Можно приезжать с собакой, рядом грибные места и река.' },
  { id: 8, name: 'Тихая заводь', place: 'Таруса, Калужская обл.', type: 'aframe', price: 7800, capacity: 2,
    amenities: ['water', 'views', 'hottub', 'wifi'], x: 65, y: 52, mood: 'dusk', wood: '#a9805a', roof: '#30343b',
    added: 5, busy: [[1, 3], [15, 2]], occupied: false, photo: '',
    desc: 'Романтичный А-фрейм для двоих. С террасы выход к воде, на закате можно рыбачить.' },
  { id: 9, name: 'Альпийское', place: 'Переславль-Залесский, Ярославская обл.', type: 'chalet', price: 13500, capacity: 7,
    amenities: ['views', 'fireplace', 'sauna', 'hottub', 'tv', 'wifi'], x: 60, y: 55, mood: 'day', wood: '#8f6140', roof: '#3d4047',
    added: 10, busy: [], occupied: true, photo: '',
    desc: 'Большое шале с баней, купелью и камином. Отлично для семейного отдыха на выходные.' },
  { id: 10, name: 'Горизонт', place: 'Селигер, Тверская обл.', type: 'modern', price: 15900, capacity: 6,
    amenities: ['water', 'views', 'hottub', 'wifi', 'tv', 'access'], x: 89, y: 24, mood: 'day', wood: '#e5e2da', roof: '#2c3033',
    added: 2, busy: [[4, 5]], occupied: false, photo: '',
    desc: 'Современный дом на берегу Селигера. Без порогов, с большой террасой и видом на озеро.' },
  { id: 11, name: 'Усадьба ветров', place: 'Суздаль, Владимирская обл.', type: 'barn', price: 8300, capacity: 10,
    amenities: ['pets', 'fireplace', 'wifi', 'sauna', 'tv'], x: 78, y: 38, mood: 'autumn', wood: '#7d6048', roof: '#5a5f66',
    added: 15, busy: [[12, 3]], occupied: false, photo: '',
    desc: 'Вместительный барнхаус для большой компании. Рядом исторический центр Суздаля.' },
  { id: 12, name: 'Северное сияние', place: 'Кемь, Карелия', type: 'dome', price: 9900, capacity: 4,
    amenities: ['views', 'woods', 'hottub'], x: 75, y: 72, mood: 'night', wood: '#a47b52', roof: '#3a3d44',
    added: 8, busy: [], occupied: true, photo: '',
    desc: 'Купол на опушке леса. Ночью небо над ним бывает таким, что не хочется спать.' },
  { id: 13, name: 'Дедов дом', place: 'Медвежьегорск, Карелия', type: 'log', price: 4900, capacity: 8,
    amenities: ['woods', 'sauna', 'pets', 'fireplace', 'water'], x: 38, y: 60, mood: 'winter', wood: '#94663f', roof: '#4b3b36',
    added: 11, busy: [[8, 3], [18, 5]], occupied: false, photo: '',
    desc: 'Самый доступный вариант: настоящий деревенский дом с печкой, баней и выходом к озеру.' },
  { id: 14, name: 'Озёрное', place: 'Лахденпохья, Карелия', type: 'chalet', price: 10400, capacity: 5,
    amenities: ['water', 'views', 'sauna', 'tv', 'wifi'], x: 20, y: 65, mood: 'dusk', wood: '#935f3a', roof: '#3a3d44',
    added: 4, busy: [[5, 2]], occupied: false, photo: '',
    desc: 'Шале на берегу Ладожского озера. Баня с видом на воду и свой причал.' },
  { id: 15, name: 'Берёзовая роща', place: 'Мещёра, Рязанская обл.', type: 'aframe', price: 6200, capacity: 3,
    amenities: ['woods', 'pets', 'fireplace'], x: 48, y: 74, mood: 'autumn', wood: '#b38a5e', roof: '#3b3a36',
    added: 13, busy: [[11, 3]], occupied: false, photo: '',
    desc: 'А-фрейм среди берёз. Осенью вокруг золотой лес, дом хорошо отапливается камином.' },
  { id: 16, name: 'Скандинав', place: 'Зеленогорск, Ленинградская обл.', type: 'modern', price: 14200, capacity: 4,
    amenities: ['views', 'wifi', 'hottub', 'sauna', 'access'], x: 86, y: 52, mood: 'winter', wood: '#e9e7e1', roof: '#2a2e31',
    added: 6, busy: [], occupied: true, photo: '',
    desc: 'Лаконичный дом в скандинавском стиле: свет, дерево, баня и купель с видом на лес.' }
];
