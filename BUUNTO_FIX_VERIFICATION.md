# Buunto Date Picker — фикс обхода блокировки Add to Cart

Дата: 2026-08-27. Задача клиента: часть заказов приходит без выбранной даты/слота
доставки от приложения **Buunto Date Picker**, хотя кнопка Add to Cart на PDP
должна блокироваться, пока виджет пуст.

Полный аудит и обоснование каждого фикса — в плане:
`C:\Users\dziza\.claude\plans\moonlit-roaming-wigderson.md` (там же ссылки на
документацию Buunto).

Статус: **E2E прогон в браузере выполнен** (Playmright, dev-тема `ohara-flowers-ch`).
Основные сценарии зелёные, см. таблицу ниже.

## Изменённые файлы

- `assets/buunto-add-to-cart.js` — переписан полностью (был submit-перехватчик
  только на PDP-форме, стал document-level guard на все формы + патч fetch/XHR).
- `layout/theme.liquid` — подключение скрипта перенесено в `<head>`, синхронно,
  до `theme.min.js`; **не грузится на gift-card** (`{% unless product.gift_card? %}`).
  Плюс добавлен body-класс `template-gift-card`.
- `sections/template--product.liquid` — старое подключение скрипта убрано,
  оставлен комментарий-указатель на `theme.liquid`.
- `assets/custom.css` — CSS-блокировка обобщена на любую `form[action*="/cart/add"]`
  с классом `.buunto-locked`, плюс отдельное правило для `.shopify-payment-button`
  (Buy It Now / Shop Pay). Плюс `.template-gift-card #buunto-date-picker { display:none }`.
- `templates/product.basic.json`, `templates/product.gift-card.json` —
  `show_smart_checkout: true` → `false` (эти шаблоны включали Buy It Now в обход
  проверки; основной `product.json` уже был `false`).

## Как теперь работает защита

Раньше: один `submit`-listener на `#AddToCartForm`, проверял только JS-событие
`BuuntoDatePicker:selectionChange`. Товар мог уйти в корзину раньше блокировки
(гонка со слушателем темы), апселлы/quick-add/Buy It Now вообще не проверялись.

Теперь (`assets/buunto-add-to-cart.js`):

1. **Источник истины — вердикт Buunto через его же JS API.** `isValid()` сначала
   спрашивает `window.Buunto.datePicker.hasErrors()` (после `appStarted`):
   `true` → блокируем, `false` → пропускаем. Buunto сам знает, какие поля
   обязательны на конкретном товаре (дата, слот, pickup-локация, индекс).
2. **Фолбэк, когда API ещё/не поднялся** — DOM формы:
   - если в форме есть Buunto-инпут `properties[...]`, который **присутствует, но
     пустой** (Buunto предзаполняет `Method` и `Shipping Time` дефолтами, оставляя
     пустой только дату) → блокируем;
   - иначе — непустые не-theme свойства = выбор сделан.
   Явно исключены свойства темы (`THEME_OWNED_PROPS`): `Recipient email`,
   `Recipient name`, `Message`, `__shopify_send_gift_card_to_recipient`.
3. **Перехват `submit` и `click`** на `document` в capture-фазе — гарантированно
   раньше listener-ов темы на самой форме.
4. **Патч `window.fetch`** (и best-effort `XMLHttpRequest.send`) на POST
   `/cart/add[.js]`:
   - payload уже с properties → пропускаем как есть;
   - properties нет → пытаемся подставить properties **из валидной формы на
     странице** (`currentPageProperties()` пропускает формы с незавершённым
     выбором — не тащим половинчатые Method+Time без даты) **или из позиции,
     уже лежащей в корзине** (`/cart.js`) — покрывает апселл «Don't forget to
     add», complementary products, quick-add;
   - взять properties неоткуда + на странице есть невыбранный виджет → блокируем
     запрос (синтетический `422`, без реального fetch), `buunto-attention` glow,
     скролл к виджету.
5. **CSS-блокировка** `button[name="add"]` и `.shopify-payment-button` через
   класс `buunto-locked` на форме.
6. **Fail-open через 20 сек**, если `window.Buunto.datePicker.appStarted` так и
   не появился (мёртвый CDN/adblock) — самовосстанавливается, если API поднимется
   позже. Виджета на странице нет вообще → не блокируем.

### Осознанные ограничения

- **Добавление вне PDP при пустой корзине** (quick-add на коллекции, покупатель
  ещё ничего не клал) пропускается без даты — взять её неоткуда, виджета на
  странице нет. Закрывается только настройкой Buunto «Date and Time slot
  validation during checkout» (серверная проверка) — раздел B плана.
- **Сторонний апп, который сам копирует предзаполненные `properties[Method]` /
  `Shipping Time` (без даты) в свой AJAX-payload** — пропускается (payload
  «выглядит заполненным»). Маловероятно; backstop — серверная валидация Buunto.
- **Selleasy / прочие апп-эмбеды**, добавляющие товар мимо fetch/XHR
  (sendBeacon, прямой `<form>` POST) — вне зоны патча.
- **Протухшая корзина** (дата на прошлую субботу) — клиентски не решается,
  только серверная валидация Buunto.

### Gift-card

Скрипт-гвард на gift-card не подключается, виджет скрыт через CSS. Если Buunto в
админке всё ещё таргетит gift-card — он может рендерить виджет (скрыт) и, при
включённом «Error check compatibility mode», сам дизейблить ATC. **Нужно
исключить gift-card в админке Buunto** (по product/tag) — это финальный шаг.

## Баги, найденные и исправленные во время E2E

1. **`isValid()` считал предзаполненные `Method`/`Time` за «выбор сделан».**
   На `true-love` Buunto ставит `properties[Method]=Shipping` и
   `properties[Shipping Time]=9:00 AM…`, оставляя `Shipping Date` пустым. Старый
   `readBuuntoProperties()` фильтровал пустое → «есть непустой property» →
   форма не блокировалась. Fix: вердикт API + проверка «есть присутствующий, но
   пустой Buunto-инпут».
2. **fetch-патч наследовал половинчатые properties.** Прямой
   `fetch('/cart/add.js',{items:[{id,quantity:1}]})` без даты → `currentPageProperties()`
   возвращал `{Method, Shipping Time}` (без даты) → `injectProperties` дописывал
   и пропускал. Fix: `currentPageProperties()` пропускает формы с `!isValid()`.

## Результаты E2E (Playwright, `ohara-flowers-ch` dev)

| # | Сценарий | Результат |
|---|---|---|
| 1 | PDP `true-love`, дата не выбрана → клик ATC (+ форс `requestSubmit`) | **0** запросов `/cart/add`, форма `.buunto-locked`, кнопка `aria-disabled`, glow + скролл ✅ |
| 2 | Выбор даты в календаре → ATC | 200, `properties = {Method, Shipping Date: "August 28, 2026", Shipping Time}` ✅ |
| 3 | Дата выбрана → прямой AJAX апселла без properties | 200, апселл **унаследовал** ту же дату ✅ |
| 4 | Свежая страница (даты нет) + dated-товар в корзине → AJAX апселла | 200, унаследовал дату **из корзины** ✅ |
| 7 | Прямой AJAX без properties, дата не выбрана, корзина пуста | **422**, корзина пуста, glow ✅ |
| — | Коллекция (нет виджета) + dated-товар в корзине → quick-add | 200, унаследовал дату из корзины ✅ |
| — | Коллекция, нет виджета, корзина пуста → quick-add | 200 без даты — осознанное ограничение |
| рег. | `perfumed-candle` (Buunto: дата не нужна — «Shipping post») | НЕ блокируется ✅ |
| рег. | Шаблон gift-card | `.shopify-payment-button` не рендерится (`show_smart_checkout:false` ок) ✅ |

Все сценарии перепроверены после отката «бага №2» — регрессий нет.

### Gift-card

Клиент подтвердил: **подарочных карт в магазине нет**. Правки под gift-card
(`{% unless product.gift_card? %}` на подключении гварда, body-класс
`template-gift-card`, CSS-скрытие виджета) оставлены как инертный защитный код —
срабатывают только если у товара `product.gift_card? == true`, чего сейчас нет.
Действий в админке Buunto по gift-card не требуется.

## Не проверено (нужен тумблер/конфиг или отдельный прогон)

- **Buy It Now / Shop Pay** (§5) — кнопка не рендерится на текущих шаблонах;
  нужен временный `show_smart_checkout:true`.
- **Quick view drawer** (§6), **два `#AddToCart` на странице** (§8) — нужен
  отдельный прогон с включёнными настройками.
- **cart → checkout** целиком, **протухшая корзина** (§11) — требуют серверной
  валидации Buunto (раздел B плана).

## Примечание по dev-серверу

`shopify theme dev` на Windows периодически залипает с ошибкой
`... .tmp.<pid>... Must have a .liquid file extension` после сохранения
`theme.liquid` (гонка watcher-а CLI с атомарным сохранением редактора). Лечится
рестартом `shopify theme dev`.
