# Материал для руководства пользователя — The Sunset Beach Resort & Spa

Собрано по коду фронтенда (`sunset-beach`, Next.js) и бэкенда (`sunset`, Spring Boot) по состоянию на дату сбора. Интерфейс системы — только на английском, поэтому все цитаты ниже — дословные строки из кода, без перевода и пересказа. Комментарии/заголовки разделов — на русском.

Два интерфейса персонала:
- **Админка** — `/admin/**`, доступ с компьютера, боковое меню слева.
- **Мобильный зал** — `/pos/**`, отдельный раздел под палец (телефон/планшет), без бокового меню, только контекстные ссылки и верхняя панель с именем текущего пользователя.

Оба входа используют один и тот же экран логина `/admin/login`.

---

## 1. Карта интерфейса

### 1.1 Роли и иерархия

Роли по возрастанию прав: `WAITER` < `CASHIER` < `MANAGER` < `ADMIN`. Право более высокой роли включает всё, что доступно более низкой (backend: `RoleHierarchy`, `SecurityConfig.java`), кроме раздела «Пользователи» (`/users/**`), который жёстко ограничен только `ADMIN` — иерархия его не распространяет.

### 1.2 Админка (`/admin/**`)

| Адрес | Заголовок на экране | Кто видит в меню | Кто может открыть по прямой ссылке | Что можно сделать |
|---|---|---|---|---|
| `/admin/login` | eyebrow «Staff access», h1 **«Admin sign in»** | доступен без входа | любой (неавторизованный) | ввести email/пароль, войти |
| `/admin` | h1 **«Dashboard»** (eyebrow «Overview») | CASHIER+ (пункт «Dashboard») | CASHIER+; WAITER перенаправляется на `/admin/pos` | посмотреть сводные цифры (брони, заполняемость, выручка номеров, выручка POS) |
| `/admin/access-denied` | h1 **«Not available for your role»** (eyebrow «Access») | не в меню | любой авторизованный (это цель редиректа) | увидеть объяснение блокировки и ссылку на «свою» страницу |
| `/admin/bookings` | h1 **«Bookings»** (eyebrow «Reservations») | CASHIER+ («Bookings») | CASHIER+ | список броней, фильтр по датам/статусу, экспорт CSV (MANAGER+) |
| `/admin/bookings/[id]` | h1 = имя гостя (динамически) | не в меню, переход из списка/календаря | CASHIER+ | детали брони, счёт (folio), изменение статуса/заметки об оплате, изменение дат/номера, переселение, история действий (MANAGER+) |
| `/admin/bookings/calendar` | h1 **«Calendar»** (eyebrow «Reservations») | CASHIER+ («Calendar») | CASHIER+ | календарная сетка броней, создание/перенос/изменение длительности мышью, панель брони |
| `/admin/rooms` | h1 **«Rooms»** (eyebrow «Inventory») | CASHIER+ («Rooms») | CASHIER+; изменения — MANAGER+ | список типов номеров, переход к редактированию/удалению (MANAGER+) |
| `/admin/rooms/new` | h1 **«New room»** | не в меню (кнопка «New room» на списке) | MANAGER+ | создать тип номера |
| `/admin/rooms/[id]/edit` | h1 = название типа номера | не в меню | MANAGER+ | изменить тип номера, фото, физические номера (комнаты) этого типа |
| `/admin/pricing` | h1 **«Pricing»** (eyebrow «Rates») | CASHIER+ («Pricing») | CASHIER+; правка — MANAGER+ | календарь цен по типу номера, задать цену на диапазон дат (MANAGER+) |
| `/admin/availability` | h1 **«Availability»** (eyebrow «Calendar») | CASHIER+ («Availability») | CASHIER+; правка блоков — MANAGER+ | обзор занятости по типу/по конкретному номеру, ручные блокировки номеров (MANAGER+) |
| `/admin/users` | h1 **«Users»** (eyebrow «Staff») | только ADMIN («Users») | только ADMIN | список сотрудников, роль, активен/нет, сброс пароля |
| `/admin/users/new` | h1 **«New user»** | не в меню (кнопка на списке) | только ADMIN | создать учётную запись |
| `/admin/account` | h1 = email пользователя (eyebrow «Account») | ссылка внизу меню (email) | любой авторизованный | сменить свой пароль |
| `/admin/history` | h1 **«History»** (eyebrow «Audit trail») | MANAGER+ («History») | MANAGER+ | журнал действий персонала, фильтры, постраничный вывод |
| `/admin/pos` | h1 **«Tables & tickets»** (eyebrow «POS») | все («POS») | любой авторизованный | доска столов/тикетов, создание заказов, управление столами (MANAGER+) |
| `/admin/pos/menu` | h1 **«Menu»** (eyebrow «POS») | все («Menu») | любой авторизованный; правка — MANAGER+ | список позиций меню, создание/правка/удаление (MANAGER+) |
| `/admin/pos/menu/new` | h1 **«New menu item»** | не в меню | MANAGER+ | создать позицию меню |
| `/admin/pos/menu/[id]/edit` | h1 = название позиции | не в меню | MANAGER+ | изменить позицию меню |
| `/admin/pos/printers` | h1 **«Printers»** (eyebrow «POS») | MANAGER+ («Printers») | MANAGER+ | список принтеров, создание/правка/удаление, тестовая печать |
| `/admin/pos/print-jobs` | h1 **«Print queue»** (eyebrow «POS») | все («Print queue») | любой авторизованный | очередь печати (по умолчанию фильтр «Failed»), повтор задания |
| `/admin/pos/orders` | h1 **«Order history»** (eyebrow «POS») | не в меню (ссылка «Order history →» на `/admin/pos`) | MANAGER+ | список заказов любого статуса за период, фильтры по столу/статусу/сотруднику/смене |
| `/admin/pos/orders/[id]` | h1 = название стола / имя гостя / «Ticket #xxxxxx» | не в меню, переход из доски/истории | любой авторизованный | состав заказа, добавление позиций, отправка на кухню, печать предчека, закрытие (CASHIER+) |
| `/admin/pos/shifts` | h1 **«Shifts»** (eyebrow «POS») | CASHIER+ («Shifts») | CASHIER+ | текущая смена: открыть/закрыть, ссылка на обзор всех смен (MANAGER+) |
| `/admin/pos/shifts/[id]` | h1 **«Shift report»** (eyebrow «POS») | не в меню | CASHIER+ (кассир — только своя смена, 404 на чужую) | итоги смены, экспорт CSV (MANAGER+), заказы этой смены (MANAGER+) |
| `/admin/pos/shifts/history` | h1 **«Shift history»** (eyebrow «POS») | не в меню (ссылка «Review all shifts →» на `/admin/pos/shifts`) | MANAGER+ | список смен за период, фильтр по сотруднику, суммы и расхождение |

### 1.3 Мобильный зал (`/pos/**`)

Постоянной боковой/нижней навигации нет. На каждом экране — верхняя панель (email, роль, кнопка «Not you? Switch»). Переходы — только контекстные ссылки.

| Адрес | Заголовок на экране | Кто может открыть | Что можно сделать |
|---|---|---|---|
| `/pos` | заголовка `<h1>` нет — сразу вкладки **«Tables»** / **«No table»** | любой авторизованный (WAITER — стартовая страница после входа) | доска столов по зонам, вкладка заказов без стола, создание заказа |
| `/pos/orders` | h1 **«Orders»** (если нет открытой смены и не передан `shiftId`) или **«Orders in this shift»** | CASHIER+ | список заказов, оплаченных в течение текущей/указанной смены |
| `/pos/orders/[id]` | h1 = название стола / имя гостя / «Ticket #xxxxxx» | любой авторизованный; оплата — CASHIER+ | состав заказа, добавление позиций, отправка на кухню, печать предчека, оплата |
| `/pos/shifts` | h1 **«Shift»** | CASHIER+ | открыть/закрыть смену со сверкой |
| `/pos/print-jobs` | h1 **«Print jobs»** | любой авторизованный | очередь печати (фильтр «Failed» по умолчанию), повтор |

Из мобильного интерфейса дальше ведут только: ссылка «Orders in this shift →» на панели смены, ссылка «Open shift →» на экране заказа (если у кассира нет открытой смены), баннер неудавшейся печати вверху доски → `/pos/print-jobs`, кнопка «Not you? Switch» → выход и обратно на `/admin/login?callbackUrl=/pos`.

### 1.4 Состав бокового меню админки по ролям

Источник: `components/admin/AdminSidebar.tsx`. Порядок пунктов — как в коде.

**WAITER:**
POS · Menu · Print queue

**CASHIER:**
POS · Menu · Print queue · Dashboard · Bookings · Calendar · Rooms · Pricing · Availability · Shifts

**MANAGER:**
POS · Menu · Print queue · Dashboard · Bookings · Calendar · Rooms · Pricing · Availability · Shifts · Printers · History

**ADMIN:**
POS · Menu · Print queue · Dashboard · Bookings · Calendar · Rooms · Pricing · Availability · Shifts · Printers · History · Users

Логотип-ссылка «The Sunset Beach» ведёт на `/admin` для CASHIER+ и на первый доступный пункт (`/admin/pos`) для WAITER — у WAITER пункта «Dashboard» в меню нет вовсе (для него это была бы пустая страница с редиректом).

---

## 2. Дословные надписи

Все строки ниже — точные цитаты из кода (JSX/TSX), без изменений. `{переменная}` — место, куда подставляется значение; рядом дан пример.

### 2.1 Статусы брони — как показаны пользователю

Статус брони (`BookingStatus`) **нигде не переводится в человекочитаемую подпись** — на экране всегда сырое значение enum, заглавными буквами, ровно так:

- **NEW**
- **CONFIRMED**
- **PAID**
- **CANCELLED**

Это значения `<option>` в выпадающем списке статуса (`BookingsTable.tsx`, `BookingStatusForm.tsx`, `BookingCardPanel.tsx`) и текст самого бейджа статуса на странице брони и на панели брони. Других обозначений (например, «New»/«Confirmed») в интерфейсе нет.

### 2.2 Статусы заказа — как показаны пользователю

Статус заказа (`OrderStatus`), в отличие от брони, **переведён** через `STATUS_LABELS` (`lib/posOrders.ts`) и показывается в этом виде:

| Значение в системе | Подпись на экране |
|---|---|
| `OPEN` | **Open** |
| `SENT` | **Sent** |
| `PAID` | **Paid** |
| `CANCELLED` | **Cancelled** |

Показывается бейджем на доске столов, на странице заказа (админка и мобильный), в списке истории заказов.

### 2.3 Прочие статусы/перечисления с подписями

**Способ оплаты** (`PAYMENT_METHOD_LABELS`): `CASH` → **Cash**, `CARD` → **Card**, `ROOM_CHARGE` → **Room charge**, `OTHER` → **Other**.

**Статус задания печати** (`PRINT_JOB_STATUS_LABELS`): `PENDING` → **Pending**, `SENT` → **Sent**, `FAILED` → **Failed**.

**Тип документа печати** (`PRINT_DOCUMENT_TYPE_LABELS`): `KITCHEN_TICKET` → **Kitchen ticket**, `BAR_TICKET` → **Bar ticket**, `PREBILL` → **Pre-bill**, `GUEST_RECEIPT` → **Guest receipt**, `Z_REPORT` → **Z-report**, `TEST_PAGE` → **Test page**.

**Отдел меню** (`MENU_DEPARTMENT_LABELS`): `KITCHEN` → **Kitchen**, `BAR` → **Bar**.

**Отдел принтера** (`PRINTER_DEPARTMENT_LABELS`): `KITCHEN` → **Kitchen**, `BAR` → **Bar**, `CASHIER` → **Cashier**.

**Зона зала** (`ZONE_LABELS`): `RESTAURANT` → **Restaurant**, `BAR` → **Bar**, `SPA` → **Spa**, `POOL` → **Pool**, `ROOM_SERVICE` → **Room service**.

**Статус смены** — тоже не переводится: в таблице истории смен (`ShiftHistoryTable.tsx`) столбец «Status» выводит сырое значение **OPEN** / **CLOSED**. На панели текущей смены статус текстом не показан — состояние видно по форме («Open a shift» vs. форма закрытия vs. «Shift closed.»).

### 2.4 Подписи денежных полей и итогов

- **Total** — сумма заказа (страница заказа, админка и мобильный).
- **Total due** — итог к оплате на странице брони (крупная цифра под разбивкой).
- **Room** / **Room charges ({N})** — строки разбивки folio, например «Room charges (2)».
- **Base price / night (฿)** — поле формы типа номера.
- **Price / night (฿)** — поле формы «Set a price range» на странице Pricing.
- **Cash** / **Card** / **Room charge** / **Payments** — карточки итогов смены (админка и мобильный).
- **Expected cash** / **Counted cash** / **Discrepancy** — блок сверки кассы при закрытии смены.
- **Opening cash float (฿)** — поле при открытии смены.
- **Counted cash (฿)** — поле при закрытии смены.
- **New room type** / **New booking total** / **Change vs. current total** — блок предпросмотра переселения (`RelocateForm`).
- **Room revenue (paid)** / **POS revenue collected** / **Charged to rooms, not yet collected** — карточки дашборда.
- **Bookings today** / **Bookings this week** / **Occupancy** — прочие карточки дашборда (не денежные, для контекста).

Формат суммы везде одинаковый: символ ฿ перед числом, `toLocaleString("en-US")` (разделитель тысяч — запятая), например **฿1,250**. Расхождение при сверке кассы формируется как `{"+" | "−"}฿{abs}` (например **+฿30** или **−฿30**) либо словом **None**, если расхождения нет.

### 2.5 Надписи на кнопках, запускающих необратимые действия

Все подтверждения ниже — нативный `window.confirm()` браузера (кроме отдельно отмеченных), кнопка сама подписана просто «Delete»/«Cancel order» и т. п.

| Кнопка | Текст подтверждения (шаблон → пример) |
|---|---|
| **Delete** (тип номера) | `Delete "${room.name}"? This can't be undone.` → *Delete "Ocean View Suite"? This can't be undone.* |
| **Delete** (физический номер) | `Delete room "${unit.label}"? This can't be undone.` → *Delete room "204"? This can't be undone.* |
| **Delete** (стол) | `Delete "${table.label}"? This can't be undone.` → *Delete "T3"? This can't be undone.* |
| **Delete** (позиция меню) | `Delete "${item.name}"? This can't be undone.` → *Delete "Pad Thai"? This can't be undone.* |
| **Delete** (принтер) | `Delete "${printer.name}"? This can't be undone.` → *Delete "Kitchen — line 1"? This can't be undone.* |
| **Cancel order** | «Cancel this order? This can't be undone.» |
| **Delete** (ручная блокировка номера) | «Remove this block? The room becomes bookable for those dates again.» |
| **Undo this relocation** | «Undo this relocation? The earlier room will cover the full merged range again.» |
| **Disable** (учётная запись сотрудника) | «Disable this account? They will be signed out immediately.» |
| **Enable** (учётная запись, обратное действие) | «Re-enable this account? They will be able to sign in again.» |

Отдельно, без нативного confirm, но с явным подтверждением личности перед отправкой — на мобильном экране оплаты и закрытия смены используется карточка `PosAttributedConfirm`: заголовок операции (например «Close order — Cash»), блок «**Will be recorded as**» с email и ролью текущего пользователя, кнопка с подписью, переданной вызывающим экраном:
- закрытие заказа: **«Confirm payment»**
- закрытие смены: **«Confirm close»**

На **админской** (десктопной) версии тех же действий (закрытие заказа, закрытие смены) такого шага-подтверждения личности нет — кнопка сразу выполняет действие.

Кнопка **«Remove»** (удаление фотографии номера, `RoomImageUploader.tsx`) подтверждения не запрашивает вовсе — фото удаляется сразу по нажатию.

Кнопка **«Reset password»** (`ResetPasswordButton.tsx`) использует `window.prompt()` («New password for this user (at least 8 characters):») — это не подтверждение, а ввод нового пароля; после успеха выводится: «Password reset — they'll need to sign in again.»

### 2.6 Экран входа (`/admin/login`)

- eyebrow: **Staff access**
- заголовок: **Admin sign in**
- поля: **Email**, **Password**
- кнопка: **Sign in** (в процессе — «Signing in…»)
- ошибка: **«Invalid email or password.»**

### 2.7 Дашборд (`/admin`)

- заголовок **Dashboard**, eyebrow **Overview**
- карточки: **Bookings today**, **Bookings this week** (sublabel «Rolling 7 days»), **Occupancy** (sublabel «Next {N} days»), **Room revenue (paid)** (sublabel «{Month}, by check-in date»)
- блок POS (свой eyebrow **POS**): **POS revenue collected** (sublabel «{Month} · cash + card + other — excludes room charges»), **Charged to rooms, not yet collected** (sublabel «Not included in any revenue figure on this dashboard — reconcile against the folio at checkout (the booking page shows the amount due)»)
- ошибка загрузки брони: «Couldn't load booking/occupancy figures — check bookings directly if you need them now.» (ссылка «bookings»)
- ошибка загрузки POS: «Couldn't load POS revenue for this period — check shifts directly if you need the numbers now.» (ссылка «shifts»)

### 2.8 Список и карточка брони

**Список (`/admin/bookings`)** — заголовки таблицы: **Guest**, **Room**, **Assigned**, **Check-in**, **Check-out**, **Total**, **Status**, **Booked**. Пустая строка при отсутствии присвоенного номера — бейдж **«Unassigned»**. Пустое состояние: «No bookings match these filters.» Фильтры формы: **From**, **To**, **Status** (опция **All**, далее статусы как в 2.1), кнопка **Filter**, кнопка **Export CSV** (только MANAGER+).

**Страница брони (`/admin/bookings/[id]`)** — подписи: «Room:», «Email:», «Phone:», «Total:», «Booked on:». Блок дат/номера: eyebrow **«Dates & room»**, кнопка **«Change»**, если не назначен — **«Not assigned yet»**, подсказка при отсутствии прав: «Changing dates/room requires a cashier account or above.» В режиме правки: поля **Check-in**, **Check-out**, **Room** (опция «Not assigned»), подсказка для не-MANAGER: «Only managers can list rooms to switch to a different one - dates can still change, and this assignment can still be cleared.» Кнопки: **«Preview price»** (в процессе — «Pricing…»), после предпросмотра — **«Confirm»** (в процессе — «Applying…») и **«Back»**, либо **«Cancel»**.

Блок статуса/заметки (`BookingStatusForm`): eyebrow **«Status»**, список статусов (2.1), предупреждение при статусе PAID и наличии начислений на номер: «This booking has {N} POS room charge{s} totaling ฿{X}. Total due including the room is ฿{Y} — make sure that's what was collected, not just the room total.» Поле **«Payment note»**, подсказка-placeholder: «e.g. terminal receipt #4471 — never enter the guest's card number». Кнопка **«Save»** (в процессе — «Saving…»).

Блок **«Folio»**: строки **Room**, **Room charges ({N})**, итог **«Total due»**. При ошибке загрузки: «Couldn't load the amount due — verify the total manually (room + any POS room charges) before checkout.»

Блок **«Room charges»** (POS-заказы, начисленные на номер) — по клику ведёт на `/admin/pos/orders/{id}`.

Блок **«History»** (MANAGER+): «No recorded actions on this booking yet.», иначе список записей с текстом и датой/временем (UTC) + «{email} ({role})».

### 2.9 Панель брони (`BookingCardPanel`, боковая панель из календаря)

Заголовок панели: eyebrow **«Booking»**, кнопка закрытия «×». При загрузке: «Loading…»; при ошибке: «Couldn't load this booking.» Если нет email/телефона: **«No email on file»** / **«No phone on file»**. Ссылка **«Open full page»**.

Блок статуса/заметки — те же подписи, что в 2.8, в компактной верстке.

Блок **«Rooms»** — по одной карточке на сегмент (после переселения — несколько), строка вида «{Room name} — {Unit label}» либо «{Room name} (unassigned)», кнопка **«Undo this relocation»** (только для сегментов после первого).

Блок дат (`BookingScheduleEditor`) — eyebrow **«Dates»**; для уже переселённой брони предупреждение: «This stay has been relocated - move the arrival date or the departure date, not both in the same change. Changing dates or rooms in the middle of the stay is Undo or Relocate, below.» Кнопка **«Preview change»** / **«Confirm change»**.

Блок номера для нерасщеплённой брони (`RoomUnitAssignmentEditor`) — eyebrow **«Room unit»**, выбор из списка или **«Unassigned»**, кнопка **«Save»**.

Блок переселения (`RelocateForm`) — свёрнут в ссылку **«Relocate to another room →»**; развёрнутый вид: eyebrow **«Relocate from a date»**, поля **«Effective date»**, **«New room type»**, **«New room unit»** (только MANAGER+), блок предпросмотра со строками **«New room type»**, **«New booking total»**, **«Change vs. current total»** (значение **«No change»**, либо `+฿{X}`/`−฿{X}`), кнопка **«Preview relocation»** → **«Confirm relocation»**, **«Cancel»**.

Блок **«Folio»** и **«Room charges»** — как на полной странице. Блок **«History»** — как на полной странице (только MANAGER+).

### 2.10 Календарь броней (`/admin/bookings/calendar`)

Заголовок **«Calendar»**, eyebrow **«Reservations»**. Подсказка под управлением: «Drag across free nights on a room's row to create a booking. Drag a booking's edge to change dates, or drag the whole bar to move it. Click a booking to open its details, change its status, or relocate it to another room.»

**Период** (`CalendarPeriodControls`): кнопки **«← Prev»**, **«Today»**, **«Next →»** (подсказки-title: «Shift back by the currently visible width» / «Shift forward by the currently visible width»); блок **«Quick pick»**: **«This month»**, **«Next 3 months»**, **«Year»**; форма — поля **«From»**, **«To»**, кнопка **«Apply»**; рядом подпись диапазона вида «{дата} – {дата} ({N} days)»; ошибка валидации: «The start date must be before the end date.» либо «That's {N} days — the calendar can show at most 366 days (about a year) at once. Pick a shorter period.»

Ошибка «диапазон слишком велик», отображаемая на самой странице (если она всё же дошла до сервера): «That range is {N} days — the calendar can show at most 366 days (about a year) at once. Pick a shorter period above.»

**Плотность** (`BookingCalendarGrid`) — независимый ползунок, подписан **«Density»**, концы шкалы **«Compact»** / **«Spacious»**, справа число вида «{N}px/day». Подсказка при слишком узких колонках: «Columns are too narrow here for precise drag-editing — click a bar to change its dates or room from the booking panel, or click an empty cell to open the new-booking form (fix the dates there if the click landed on the wrong day). Increase density to drag directly instead.»

Форма создания брони из сетки (`BookingCreateFromGridModal`): eyebrow **«New booking»**, поля **«Check-in»**, **«Check-out»** (оба редактируемы, даже если заполнены протягиванием/кликом), строка «{N} night{s}» либо «Check-in must be before check-out.», поля **«Guest name»** (обязательно), **«Email (optional)»** (placeholder «Walk-in — leave blank if none»), **«Phone (optional)»**, кнопка **«Create booking»** (в процессе — «Creating…»), **«Cancel»**. После создания: eyebrow **«Booking created»**, кнопка **«Done»**.

Диалог подтверждения переноса/изменения дат мышью (`scheduleConfirm`): eyebrow **«Confirm change»**, строка «{N} night{s}», кнопки **«Confirm»** / **«Cancel»**, либо **«Close»** при ошибке.

### 2.11 Rooms / Pricing / Availability

**Rooms** (`/admin/rooms`) — заголовок **«Rooms»**, eyebrow **«Inventory»**, кнопка **«New room»**; строка карточки: «{capacity} guests · {N} active {room|rooms} · ฿{X}/night base»; пустое состояние — «No rooms yet.»

**New/Edit room** — поля **«Name»**, **«Description»**, **«Capacity (guests per room)»**, **«Base price / night (฿)»**; в режиме правки подпись: «{N} active room{s} of this type. This count is computed from the rooms below — add, rename, or deactivate them there rather than editing a number here.» Кнопка **«Create room»** / **«Save changes»**.

**Photos** (`RoomImageUploader`) — подпись **«Photos»**, кнопка загрузки, пустое состояние — «No photos yet.», кнопка на фото при наведении — **«Remove»**.

**Rooms** (физические номера типа, `RoomUnitManager`) — поля **«Label»**, чекбокс **«Active»**; строка карточки — «{Label}» / «Active» или «Inactive»; пустое состояние — «No rooms set up yet — add one below.»; кнопка **«New room»**, в форме — **«Create room»**.

**Pricing** (`/admin/pricing`) — заголовок **«Pricing»**, eyebrow **«Rates»**; подпись под календарём: «Coral = manually set price. Otherwise showing the room's base price.»; форма **«Set a price range»**: **«From»**, **«To»**, **«Price / night (฿)»**, кнопка **«Apply to range»**; для не-MANAGER: «Setting prices requires a manager account.»

**Availability** (`/admin/availability`) — заголовок **«Availability»**, eyebrow **«Calendar»**; выбор **«Room type»**; подпись: «Each day shows free/total rooms of this type. Click a day to see which specific rooms are free, booked, or blocked, and to manage a room's blocks. A review mark means at least one block that day was auto-migrated from the old system and hasn't been checked yet.»; статус юнита: **Booked** / **Blocked** / **Free**; ссылка **«view booking»**. Детальный вид одного номера: заголовок «Room {label}», подпись «Sea = free, coral = blocked, dark = booked.»; форма **«Add block»**: **«From»**, **«To»**, **«Reason»**, кнопка **«Add block»**; список блоков, пометка автоперенесённых: «⚠ Needs review — {reason}»; для не-MANAGER: «Only managers can view or edit the block list. Blocked days for this room still show on the calendar above.»

### 2.12 POS-доска, столы, тикеты (админка и мобильный)

Вкладки: **«Tables»** / **«Open tickets {(N)}»** (админка) или **«Tables»** / **«No table {(N)}»** (мобильный). Пустые состояния: «No tables set up yet — add one below.» / «No open tickets.» Выбор при нескольких открытых заказах на одном столе: «{table} has {N} open orders — pick one:» → строка вида «#{id} · {StatusLabel}», кнопка **«Cancel»**.

Форма нового «безстольного» тикета: placeholder **«Guest name (optional)»**, кнопка **«New ticket»**.

**Управление столами** (`TableManager`, только под сворачиваемым блоком «Manage tables» / «Hide table management»): поля **«Zone»**, **«Label»**, **«Capacity»**, чекбокс **«Active»**; строка: «Seats {N}{ · Inactive}»; для не-MANAGER без столов: «No tables set up yet. Ask a manager to add some.»

**Страница заказа** (`OrderTicket` / `PosOrderTicket`): строка после отправки: «Already sent — sent lines can't be edited or removed, but you can still add more.» Пустое состояние: «No items yet.» Кнопка удаления строки — **«Remove»** (в процессе — «Removing…»). Кнопка отправки — **«Send order»** (админка) / **«Send to kitchen»** (мобильный), в процессе — «Sending…». Кнопка **«Print pre-bill»** (в процессе — «Printing…»); индикатор в процессе печати: «Sending to printer…»; результат: «No active cashier printer configured — nothing printed.» / «Pre-bill printed.» / «Printer didn't respond — retrying automatically.» / «Print failed{: {lastError}} — it's in the print queue for retry.»

Блок оплаты — eyebrow **«Payment»** / **«Close order»**; без открытой смены: «Open a shift to accept payment.» со ссылкой **«Open shift →»**; кнопки методов — **«Cash»**, **«Card»**, **«Charge to room»** (админка) / **«Room»** (мобильный). После оплаты: «Paid via {method} — ฿{amount}».

**Charge to room** (`RoomChargeLink`, админка — список; `PosRoomChargeSearch`, мобильный — поиск): eyebrow **«Charge to room»**; при пустом списке — «No checked-in bookings found for today.» (админка) / «No currently-staying bookings match.» (мобильный, поиск по имени, placeholder **«Guest name…»**); кнопка **«Confirm»** (в процессе — «Charging…»), **«Back»**.

Кнопка **«Cancel order»** внизу карточки — см. 2.5.

**Добавление позиции** — админка (`AddOrderItemForm`, выпадающий список): поля **«Item»**, **«Qty»**, **«Note»** (placeholder «e.g. no ice»), кнопка **«Add»» (в процессе — «Adding…»); мобильный (`PosMenuPicker`, крупные плитки): поле поиска placeholder **«Search menu…»**, категории — кнопки-вкладки, плитка позиции — название + цена, пустое состояние «No matching items.» / «No available menu items.»

**Menu** (`/admin/pos/menu`) — заголовок **«Menu»**, кнопка **«New item»**; строка: «{category} · ฿{price}{ · Unavailable}»; бейдж отдела (Kitchen/Bar); пустое состояние — «No menu items yet.» Форма позиции: **«Name»**, **«Description»**, **«Category»** (подсказка: «How this item is grouped on the menu display. Doesn't affect printing.»), **«Department»** (подсказка: «Which printer this item's ticket is sent to when the order is sent.»), **«Price (฿)»**, чекбокс **«Available»**; кнопка **«Create item»** / **«Save changes»**.

**Printers** (`/admin/pos/printers`) — заголовок **«Printers»**, пояснение: «Each department (Kitchen, Bar, Cashier) can have at most one active printer. Use Test print after adding or editing one to confirm the host/port/codepage are actually right — a printer that looks configured but isn't reachable will silently queue failed jobs instead of tickets. Failed jobs show up in the print queue.» Форма: **«Name»** (placeholder «e.g. Kitchen — line 1»), **«Department»**, **«Host»** (placeholder «192.168.1.50»), **«Port»**, **«Codepage»**, чекбокс: «Active — the live printer for this department (only one active printer allowed per department)»; кнопка **«Test print»** (в процессе — «Printing…»), результат: «Printed successfully» либо «{StatusLabel}{: lastError}»; пустое состояние — «No printers set up yet — add one below.»

**Print queue** (`/admin/pos/print-jobs`, `/pos/print-jobs`) — заголовок **«Print queue»** (админка) / **«Print jobs»** (мобильный); пояснение (только админка): «A failed job means a kitchen/bar ticket, pre-bill, receipt, or Z-report never reached its printer. Retry re-sends exactly what was originally queued — it won't regenerate the document from current data, so if the underlying printer setup changed, fix that first (see Printers).» Фильтры-кнопки: **Failed**, **Pending**, **Sent**, **All** (плюс на админке — станции: **All stations**, **Kitchen ticket**, **Bar ticket**). Строка задания: сводка (`summary`), тип документа, «{N} attempt{s}», ошибка — курсивом/цветом; кнопка **«Retry»** (в процессе — «Retrying…»). Пустое состояние: «No print jobs{ with status {filter}}.»

Баннер неудавшейся печати (доска столов, обе версии): «{N} failed print {job|jobs} — a ticket may not have reached the kitchen/bar»; при недоступности проверки: «Print status unavailable — check queue».

### 2.13 Смены

**Открытие смены** — eyebrow **«Open a shift»**, поле **«Opening cash float (฿)»**, кнопка **«Open shift»** (в процессе — «Opening…»).

**Текущая смена** — карточки **Cash / Card / Room charge / Payments**; ссылка **«Orders in this shift →»** (MANAGER+ на админке; на мобильном — всем CASHIER+). Форма закрытия: eyebrow **«Close shift»**, поле **«Counted cash (฿)»**, блок сверки (**Expected cash / Counted cash / Discrepancy**), поле **«Notes»**, кнопка **«Close shift»** (админка) / **«Review & close»** (мобильный, ведёт на экран подтверждения личности, кнопка **«Confirm close»**). После закрытия: «Shift closed.» + ссылка **«Export CSV»** (MANAGER+, только админка) + блок сверки ещё раз.

Блокировка закрытия: «Can't close — there are still open orders somewhere in the system, not just on this shift.» (админка) / «Can't close — there are still open orders somewhere.» (мобильный) со ссылкой **«View open orders →»** / **«View orders →»**.

**Отчёт по смене** (`/admin/pos/shifts/[id]`) — заголовок **«Shift report»**, строка диапазона времени «{openedAt} — {closedAt|open}», карточки итогов, заметки («Notes: {text}»), ссылки **«Export CSV»**, **«Orders in this shift →»**.

**История смен** (`/admin/pos/shifts/history`) — заголовок **«Shift history»**, ссылка **«My current shift →»**, фильтр **From/To**, таблица со столбцами **Opened, Staff, Status, Cash, Card, Room charge, Expected, Counted, Discrepancy**; пустое состояние — «No shifts in this period.» / «No shifts for this staff member in this period.»

**История заказов** (`/admin/pos/orders`, `/pos/orders`) — заголовок **«Order history»** (админка) / **«Orders»**/**«Orders in this shift»** (мобильный); фильтры (только админка) **From/To/Status/Table**, выбор сотрудника; таблица со столбцами **Opened, Table / Guest, Staff, Status, Payment, Total**; пустое состояние — «No orders match these filters.» / «No orders for this staff member in these filters.» / «No orders were paid during this shift.» На мобильном без открытой и без указанной смены: «No open shift right now, and none was specified.» со ссылкой **«Open a shift →»**.

### 2.14 Пользователи, аккаунт, журнал действий

**Users** (`/admin/users`) — заголовок **«Users»**, кнопка **«New user»**; строка: email, бейдж **«Disabled»** (если выключен), «Joined {date}»; элементы управления в строке — **«Reset password»**, переключатель **«Disable» / «Enable»**, выбор роли (`<select>` с ролями WAITER/CASHIER/MANAGER/ADMIN).

**New user** — поля **«Email»**, **«Temporary password»**, **«Role»**; кнопка **«Create user»** (в процессе — «Creating…»).

**Account** (`/admin/account`) — заголовок = email, под ним — роль текстом; форма смены пароля: **«Current password»**, **«New password»**, кнопка **«Change password»** (в процессе — «Saving…»); успех: «Password changed.»

**History** (`/admin/history`) — заголовок **«History»**, eyebrow **«Audit trail»**; подпись: «Read-only record of significant staff actions — money and guest data. {N} matching entr{y|ies}.» Фильтры: **«Staff email»** (placeholder «contains…»), **«Action»**, **«Entity type»**, **«Entity ID»** (placeholder «requires entity type»), **«From»**, **«To»**, кнопка **«Filter»**. Пустое состояние: «No matching entries.» Пагинация: **«← Prev»**, «Page {N}», **«Next →»**.

Названия действий (`ACTIONS`) в фильтре и в строке журнала выводятся автогенерируемой подписью (подчёркивания → пробелы, первая буква заглавная), например `BOOKING_STATUS_CHANGED` → **«Booking status changed»**, `ROOM_UNIT_BLOCK_CREATED` → **«Room unit block created»**. Полный список кодов действий: `BOOKING_CREATED`, `BOOKING_STATUS_CHANGED`, `BOOKING_PAYMENT_NOTE_CHANGED`, `BOOKING_SCHEDULE_CHANGED`, `BOOKING_ROOM_ASSIGNED`, `BOOKING_RELOCATED`, `BOOKING_RELOCATION_UNDONE`, `BOOKINGS_EXPORTED`, `ROOM_PRICE_CHANGED`, `RATE_OVERRIDE_CHANGED`, `ORDER_CLOSED`, `ORDER_CANCELLED`, `ROOM_CHARGE_POSTED`, `SHIFT_OPENED`, `SHIFT_CLOSED`, `SHIFT_EXPORTED`, `USER_CREATED`, `USER_ROLE_CHANGED`, `USER_ACTIVE_CHANGED`, `USER_PASSWORD_RESET`, `ROOM_UNIT_CREATED`, `ROOM_UNIT_UPDATED`, `ROOM_UNIT_DELETED`, `ROOM_UNIT_BLOCK_CREATED`, `ROOM_UNIT_BLOCK_DELETED`.

### 2.15 Шаблонные строки (собираются из частей)

| Место | Шаблон | Пример |
|---|---|---|
| Подтверждение удаления (везде) | `Delete "${name}"? This can't be undone.` | *Delete "Ocean View Suite"? This can't be undone.* |
| Отказ удаления номера/стола/принтера (см. §3) | `"${name}" has {X} on record and can't be deleted. Deactivate it instead (Edit → uncheck Active) to {Y}.` | *"T3" has orders on record and can't be deleted. Deactivate it instead (Edit → uncheck Active) to hide it from new orders while keeping its history.* |
| Строка карточки типа номера | `${capacity} guests · ${activeUnitCount} active ${room|rooms} · ฿${basePrice}/night base` | *4 guests · 3 active rooms · ฿3,500/night base* |
| Строка карточки стола | `Seats ${capacity}${" · Inactive" if !isActive}` | *Seats 4* |
| Строка позиции меню | `${category} · ฿${price}${" · Unavailable" if !isAvailable}` | *Mains · ฿250* |
| Строка принтера | `${host}:${port} · ${codepage}${" · Inactive" if !isActive}` | *192.168.1.50:9100 · PC437* |
| Счётчик неудавшейся печати | `${N} failed print ${job|jobs} — a ticket may not have reached the kitchen/bar` | *2 failed print jobs — a ticket may not have reached the kitchen/bar* |
| Пометка «ночей» | `${N} night${s}` | *1 night*, *3 nights* |
| Итог/изменение цены | `${"+"|"−"}฿${abs}` либо «No change»/«None» | *+฿150*, *−฿30*, *No change* |
| Активных номеров у типа | `${N} active room${s} of this type. This count is computed from the rooms below — add, rename, or deactivate them there rather than editing a number here.` | *3 active rooms of this type. …* |
| Пустой список печати с фильтром | `No print jobs${" with status " + filter if filter}.` | *No print jobs with status failed.* |
| Позиций в заказе (журнал/POS-начисления) | `${quantity}× ${itemName}` (несколько — через «; » или «, ») | *2× Mojito; 1× Caesar salad* |

---

## 3. Сообщения об отказах и ошибках

Ниже — дословный текст, который персонал реально может увидеть в обычной работе (не программные ошибки), и условие возникновения. Сообщение показывается либо как отдельная строка на экране (обычно `text-coral`, компонент сам решает, где), либо как текст в `window.confirm`-подобном месте — здесь это не различается, важен сам текст.

### 3.1 Брони, даты, переселение

| Сообщение | Когда возникает |
|---|---|
| «checkIn must be before checkOut» | При создании брони (с сайта, со стойки) или изменении дат — дата выезда не позже даты заезда. |
| «Room not found» | Указан несуществующий тип номера. |
| «Someone just booked these dates — please try again.» | Кто-то параллельно занял те же даты/номер раньше, чем эта заявка успела сохраниться (создание брони, назначение номера или переселение). |
| «Selected dates are no longer available» | На выбранные даты не осталось ни одной свободной комнаты этого типа. |
| «roomUnitId is required (send null to unassign)» | Программная ошибка формы — поле номера не передано вовсе (для персонала не должно возникать при обычной работе через интерфейс). |
| «Room {label} is a different room type than requested» | Попытка присвоить физический номер, который относится к другому типу номеров. |
| «Room {label} is not active» | Присвоение неактивного (выключенного) номера. |
| «Room {label} is blocked ({reason}) from {from} to {to}» | Присвоение/переселение в номер, у которого есть ручная блокировка на эти даты. |
| «Room {label} is already booked for an overlapping stay» | Присвоение/переселение в номер, уже занятый другой бронью на пересекающийся период. |
| «Someone just assigned this room — please try again.» | Гонка при одновременном назначении номера двумя сотрудниками. |
| «This booking has been split by a room relocation — change dates or rooms per segment via relocate/undo-relocate instead.» | Попытка назначить/снять номер напрямую, либо неоднозначное изменение дат, у брони, которая уже была переселена (больше одного сегмента). |
| «New check-in must stay before {date} - crossing into the next segment isn't a schedule change, it's a relocation.» | Через обычную форму дат пытаются сдвинуть заезд переселённой брони за границу следующего сегмента. |
| «New check-out must stay after {date} - crossing into the previous segment isn't a schedule change, it's an undo-relocation.» | То же для даты выезда и предыдущего сегмента. |
| «Someone just changed this booking's schedule — please try again.» | Гонка при одновременном изменении дат. |
| «effectiveDate must fall within this booking's stay» | Дата начала переселения выходит за пределы проживания. |
| «effectiveDate must be strictly after {date} - relocating on a segment's own first night just means assigning that segment a different room, not a mid-stay move» | Дата переселения совпадает с первой ночью текущего сегмента — это не «переселение посреди проживания». |
| «Selected room type has no availability for that period» | Для нового типа номера нет свободной комнаты на период переселения. |
| «Cannot undo — the earlier room type has no availability for the merged period» | Отмена переселения невозможна: у более раннего номера/типа нет свободного места на объединённый период. |
| «No relocation boundary at {date}» | Указанная дата не совпадает с реальной границей переселения. |
| «This looks like it contains a payment card number. Don't store full card numbers here - use a reference number or the last 4 digits instead.» | В поле «Payment note» обнаружена последовательность цифр длиной 13–19, проходящая проверку по алгоритму Луна (похожа на номер карты). |
| «from must be before to» | В календаре броней дата «до» не позже даты «с» (обычно недостижимо через интерфейс, форма сама этого не допускает). |
| «Range too large (max 366 days)» / «That's {N} days — the calendar can show at most 366 days (about a year) at once. Pick a shorter period.» | Запрошенный диапазон в календаре броней или в форме цен превышает 366 дней. |

### 3.2 Заказы и смены

| Сообщение | Когда возникает |
|---|---|
| «Table not found» / «Booking not found» | Заказ создаётся/обновляется со ссылкой на несуществующий стол/бронь. |
| «Menu item not found: {id}» | В заказ добавляется позиция меню, которой больше нет. |
| «Order is not open or sent» | Попытка добавить позицию в уже оплаченный или отменённый заказ. |
| «Order is not open» | Попытка изменить количество/удалить строку в заказе не в статусе Open (например, уже отправленном на кухню). |
| «Only the OPEN -> SENT transition is allowed here» | Попытка выставить заказу любой статус, кроме перехода Open → Sent, через это действие. |
| «Order is already {status}» (например, «already paid») | Повторное закрытие или отмена уже закрытого/отменённого заказа. |
| «You don't have an open shift» | Попытка закрыть заказ (принять оплату), не открыв смену. |
| «bookingId required when method is ROOM_CHARGE» | Закрытие заказа способом «на номер» без выбранной брони. |
| «Booking is cancelled» | Начисление на номер брони, которая отменена. |
| «This order was already closed by another request.» | Два одновременных запроса на закрытие одного заказа. |
| «You already have an open shift» | Повторное открытие смены при уже открытой. |
| «Shift is already closed» | Повторное закрытие уже закрытой смены. |
| «There are still OPEN/SENT orders that need to be closed or cancelled first» | Попытка закрыть смену, пока где угодно в системе (не только у этого кассира) остался хоть один незакрытый заказ (Open или Sent). |
| «Shift not found» | Неверный id смены, либо (для CASHIER, открывающего чужую смену) намеренно возвращается 404 вместо «доступ запрещён», чтобы нельзя было даже подтвердить существование чужой смены по id. |

### 3.3 Печать

| Сообщение | Когда возникает |
|---|---|
| «No active cashier printer configured — nothing printed.» | Печать предчека при отсутствии активного принтера отдела Cashier — задание печати даже не создаётся. |
| «Sending to printer…» (не ошибка, индикатор) | Показывается всегда сразу после нажатия «Print pre-bill», пока идёт попытка соединения (обычно ~2 секунды до таймаута соединения). |
| «Printer didn't respond — retrying automatically.» | Задание печати создано, но принтер не ответил при первой попытке — статус Pending, система повторит попытку сама (см. §4/§5). |
| «Print failed{: {lastError}} — it's in the print queue for retry.» | Все автоматические попытки исчерпаны — статус Failed, нужен ручной Retry. `{lastError}` — как правило, сетевая ошибка (например, «Connection refused» или «Connection timed out»). |
| «This printer has existing print jobs and can't be deleted.» | Удаление принтера, у которого уже есть история заданий печати. |

### 3.4 Номера, цены, доступность, стол, меню, принтеры (управление)

| Сообщение | Когда возникает |
|---|---|
| «This room has existing bookings or room units and can't be deleted.» | Удаление типа номера, у которого есть брони или физические комнаты. |
| «This menu item has existing order lines and can't be deleted.» | Удаление позиции меню, которая уже встречается в чьих-то заказах. |
| «This table has open orders and can't be deleted.» | Удаление стола, у которого есть открытые заказы. |
| «This label is already in use by another room.» | Создание/переименование физического номера с меткой, уже занятой другим номером. |
| «Room {label} has an upcoming booking assigned and can't be deactivated.» / «…can't be deleted.» | Деактивация/удаление физического номера, на который назначена будущая (ещё не завершившаяся) непустая бронь. |
| «Room {label} has bookings on record and can't be deleted.» | Удаление физического номера, у которого остались брони в истории (даже прошедшие). |
| «fromDate must be on or before toDate» | Создание ручной блокировки номера с датой «до» раньше даты «с». |
| «No files provided» | Загрузка фото номера без выбранного файла. |
| «{filename} exceeds the 8MB limit» | Файл фото номера больше 8 МБ. |
| «Unsupported file type: {type}» | Загружаемый файл — не JPEG/PNG/WebP (проверяется по реальному содержимому файла, не по расширению). |
| «from must be on or before to» | Задание диапазона цен с датой «до» раньше даты «с». |
| «path is required» | Удаление фотографии номера без указания какой именно (не должно возникать при обычной работе через интерфейс). |

### 3.5 Пользователи и вход

| Сообщение | Когда возникает |
|---|---|
| «Invalid email or password.» (форма входа) | Неверные email/пароль. То же сообщение — если аккаунт существует, но выключен (специально неразличимо). |
| «Too many failed login attempts. Try again later.» | 5-я неудачная попытка входа с одной пары (IP, email) в скользящем окне 15 минут. |
| «Current password is incorrect» | Смена собственного пароля с неверным текущим паролем. |
| «You can't change your own role» | Администратор пытается изменить свою же роль. |
| «You can't disable your own account» | Администратор пытается выключить свою же учётную запись. |
| «A user with that email already exists» | Создание сотрудника с email, который уже используется. |

### 3.6 Сеть (мобильный интерфейс)

| Сообщение | Когда возникает |
|---|---|
| «No connection — check the network and try again.» | Любое действие в разделе `/pos`, когда запрос не дошёл до сервера вообще (нет сети, DNS, таймаут) — отдельно от обычной ошибки сервера. |

---

## 4. Пошаговые сценарии

Все шаги — по фактическому поведению кода, не по общим рекомендациям.

### 4.1 Заявка гостя с сайта и её подтверждение
**Роли:** заявку создаёт гость (не персонал); подтверждает/отклоняет — CASHIER и выше.

1. Гость на публичном сайте отправляет форму брони → бэкенд создаёт бронь со статусом **NEW**, источник — «публичная» (в отличие от созданной персоналом).
2. Гостю уходит письмо о новой заявке.
3. Если заявка простаивает без подтверждения 1 «рабочий день» (будни, без выходных), ADMIN/MANAGER получают одно сводное письмо-напоминание по всем таким заявкам сразу (не по одному письму на заявку) — проверка идёт раз в 15 минут.
4. Если заявка простаивает без подтверждения 2 «рабочих дня» — она автоматически переводится в **CANCELLED**. Гостю при этом письмо **не** отправляется (только при подтверждении/отклонении вручную персоналом гость получает письмо).
5. Пока заявка не отменена, персонал (CASHIER+) может открыть её (`/admin/bookings/[id]` или список) и вручную сменить статус на **CONFIRMED** или **CANCELLED** — при ручном изменении статуса гостю уходит письмо.
6. Автоматической отмене подлежат только заявки с публичного сайта — заявки, заведённые персоналом со стойки, не отменяются автоматически никогда.

### 4.2 Заведение брони на стойке без предварительной заявки
**Роли:** CASHIER и выше.

1. Кассир создаёт бронь либо из календаря (протягивание по свободным клеткам при достаточной плотности, либо клик по клетке при узкой плотности), либо (если такая форма подключена где-то ещё) через прямой вызов «staff»-создания.
2. Форма требует: тип номера (уже выбран той строкой/клеткой, где создавали), даты заезда/выезда (обязательны, редактируемы прямо в форме), имя гостя (обязательно).
3. Email и телефон — необязательны.
4. Если в момент клика/протягивания сотрудник уже стоял на конкретном физическом номере (в календаре строки — по физическим номерам) — этот номер присваивается брони сразу, в одной операции с созданием (нет промежуточного состояния «бронь есть, номер ещё не назначен»).
5. Письмо гостю о новой заявке **не** отправляется (в отличие от публичной заявки) — это не «заявка», а уже подтверждённое бронирование, сделанное человеком за стойкой.
6. В журнал действий пишется запись «Staff booking created for {guest} in {room} ({checkIn} to {checkOut}); room {unit}».

### 4.3 Назначение комнаты
**Роли:** просматривать список физических номеров для выбора — MANAGER и выше; само действие назначения/снятия — CASHIER и выше (но без списка выбирать физически нечего, кроме варианта «Unassigned»).

1. На странице брони или на панели брони — блок номера; для однократной (не переселявшейся) брони есть отдельный контрол «Room unit».
2. CASHIER без MANAGER-доступа видит только возможность снять назначение («Unassigned»); выбрать конкретный физический номер из списка он не может — списка ему просто не показывают.
3. При выборе номера проверяется: тот же тип номера, номер активен, не заблокирован вручную на эти даты, не занят другой бронью на пересекающийся период.
4. Действие для нерасщеплённой брони — одно сохранение, без предварительного расчёта цены (тип и даты не меняются, цена не меняется).
5. Для уже переселённой брони (больше одного сегмента) отдельного контрола назначения нет — доступны только «Undo this relocation» и «Relocate to another room».

### 4.4 Заселение и переселение в другой номер
**Роли:** переселение — CASHIER и выше (выбор конкретного нового физического номера — MANAGER и выше).

В системе **нет отдельного статуса или действия «заселение»/«check-in»**. Является ли гость уже проживающим — нигде не хранится отдельным флагом; это определяется исключительно тем, попадает ли сегодняшняя дата в интервал `checkIn ≤ сегодня < checkOut` брони.

Переселение (`Relocate`):
1. Открыть панель/страницу брони → «Relocate to another room».
2. Указать дату, с которой начинается переселение («Effective date») — обязательно строго позже даты заезда текущего сегмента (нельзя «переселить» с первой же ночи — это было бы просто сменой номера, см. 4.3).
3. Выбрать новый тип номера (можно тот же или другой — переселение допускает смену типа, например апгрейд/даунгрейд).
4. MANAGER+ дополнительно может выбрать конкретный физический номер нового типа; CASHIER без MANAGER — только «Unassigned».
5. «Preview relocation» — расчёт нового итога брони и разницы к текущему итогу (при переселении в тот же тип разница всегда 0 — тариф зависит от типа, не от конкретной комнаты).
6. «Confirm relocation» — бронь расщепляется на два (и более) сегмента: старый сегмент укорачивается до даты переселения, новый сегмент занимает новый номер/тип до конца проживания.
7. Отмена переселения («Undo this relocation») объединяет два соседних сегмента обратно в один, снова проверяя, что более ранний номер/тип свободен на объединённый период.

### 4.5 Продление и сокращение проживания
**Роли:** CASHIER и выше.

1. Для не переселённой брони обе даты (заезд и выезд) можно менять свободно одной формой.
2. Для уже переселённой брони — можно менять только ОДНУ дату за раз: либо дату заезда первого сегмента (более ранний заезд), либо дату выезда последнего сегмента (продление/сокращение проживания); менять обе одновременно система не даёт (это создаёт неоднозначность — какой сегмент менять) и предлагает вместо этого Undo/Relocate.
3. Двигать дату можно только не пересекая границу соседнего сегмента (иначе система требует переселения/отмены переселения, а не «изменения дат»).
4. «Preview change» показывает новую цену и число ночей до подтверждения.
5. Изменение дат никогда не меняет физический номер — номер, который уже стоит на этом сегменте, пересылается в запросе без изменений.

### 4.6 Выставление счёта и просмотр итога к оплате
**Роли:** просмотр — CASHIER и выше.

1. Итог к оплате (folio) = стоимость проживания брони + сумма всех POS-заказов, закрытых способом «на номер» (ROOM_CHARGE) на эту бронь.
2. Считается на лету при каждом открытии страницы/панели брони, нигде не хранится отдельной суммой.
3. Показывается отдельным блоком «Folio»: строка «Room» (стоимость проживания), строка «Room charges ({N})» (сумма POS-начислений), итог «Total due».
4. Ниже — список конкретных POS-заказов, начисленных на эту бронь, с датой и суммой; клик по заказу открывает его карточку в POS.
5. Если статус брони меняют на PAID при наличии непустых POS-начислений — экран отдельно предупреждает суммой «Total due including the room is ฿{X} — make sure that's what was collected».

### 4.7 Открытие смены
**Роли:** CASHIER и выше.

1. У сотрудника не должно быть уже открытой своей смены (система не даёт открыть вторую).
2. Указывается «Opening cash float» (наличные в кассе на начало смены) — необязательное поле, по умолчанию не задано.
3. После открытия сразу видны нулевые (или ещё не набежавшие) итоги по Cash/Card/Room charge/Payments.
4. Смена привязана лично к открывшему её сотруднику — нет понятия «общая касса на несколько человек».

### 4.8 Приём заказа официантом
**Роли:** WAITER и выше.

1. На доске выбирается стол (или создаётся «безстольный» тикет с необязательным именем гостя) → создаётся заказ в статусе **Open**.
2. Позиции добавляются по одной (на мобильном — тап по плитке, добавляет количество 1 за раз); повторное добавление той же позиции с той же заметкой **объединяется** в одну строку с увеличенным количеством, а не создаёт вторую строку — но только пока эта строка ещё не отправлена на кухню.
3. Количество/заметку уже добавленной, но ещё не отправленной строки можно поправить (мобильный — кнопки +/−; админка — форма с полным набором полей); удалить строку можно тоже только пока заказ в статусе Open.
4. «Send to kitchen» (мобильный) / «Send order» (админка) — доступна только для статуса Open и только если в заказе есть хотя бы одна позиция; переводит заказ в **Sent** и в этот момент печатаются кухонный/барный чеки (разбитые по отделу блюда — кухонные позиции и барные попадают в разные чеки на разные принтеры).

### 4.9 Дозаказ в уже отправленный заказ
**Роли:** WAITER и выше.

1. К заказу в статусе **Sent** по-прежнему можно добавлять новые позиции (кнопка отправки при этом уже не показывается — редактировать/удалять уже отправленные строки нельзя).
2. Новая позиция объединяется в существующую строку, только если та строка ещё не была отправлена на кухню; если совпадающая по названию и заметке строка уже отправлена — создаётся новая отдельная (неотправленная) строка.
3. Так как явной кнопки «отправить» для дозаказа нет, система сама, сразу при сохранении, печатает чек по всем ещё не отправленным строкам заказа (разбитым по отделу) и помечает их отправленными — печатается только новое/неотправленное, а не весь заказ заново.

### 4.10 Закрытие заказа наличными, картой и на счёт номера
**Роли:** CASHIER и выше; заказ должен быть в статусе Open или Sent; у закрывающего должна быть открыта своя смена (иначе — «Open a shift to accept payment.» со ссылкой на открытие смены).

1. **Cash / Card** — на мобильном выбор способа открывает карточку подтверждения личности («Will be recorded as {email}/{role}») с кнопкой «Confirm payment»; на десктопе (админка) — кнопка сразу закрывает заказ без промежуточного подтверждения.
2. **Room charge** — сначала находится бронь: на мобильном — поиск по имени гостя (со сдвигом 300 мс на ввод), на десктопе — выпадающий список; в обоих случаях список ограничен бронями со статусом ровно **CONFIRMED**, чей период пребывания захватывает сегодняшний день (см. §8 про PAID-брони).
3. Сумма к оплате всегда равна текущему итогу заказа — клиент не может передать свою сумму, частичная оплата не поддерживается в принципе (заказ либо целиком не оплачен, либо целиком оплачен один раз).
4. После успешного закрытия: статус заказа — **Paid**, создаётся запись оплаты, привязанная к текущей открытой смене кассира; печатается гостевой чек (если настроен принтер отдела Cashier); при способе «на номер» дополнительно создаётся запись в журнале о начислении на бронь.
5. Повторное закрытие уже закрытого/отменённого заказа — отказ (см. §3.2).

### 4.11 Закрытие смены со сверкой кассы
**Роли:** CASHIER и выше.

1. Кнопка закрытия недоступна («заблокирована»), если где угодно в системе (не только у этого сотрудника) остался хоть один заказ в статусе Open или Sent — сообщение прямо ссылается на список открытых заказов.
2. Вводится «Counted cash» (физически пересчитанные наличные) — необязательно.
3. Сверка считается сразу, вживую, ещё до подтверждения: «Expected cash» = открывающий остаток + сумма наличных платежей за смену; «Discrepancy» = введённое − ожидаемое (положительное — лишние деньги, отрицательное — недостача, «None» — совпало).
4. На мобильном закрытие — два шага: «Review & close» показывает итог ещё раз с подтверждением личности, затем «Confirm close»; на десктопе — одна кнопка «Close shift».
5. После закрытия печатается Z-отчёт на принтер отдела Cashier (если настроен) с теми же цифрами; начисления на номер (Room charge) в «полученную» сумму никогда не входят — это перенос долга на бронь, а не деньги в кассе.
6. Экспорт CSV-отчёта по смене и просмотр заказов этой смены — только MANAGER и выше, даже для собственной смены кассира.

### 4.12 Работа с очередью печати при недоступном принтере
**Роли:** просмотр и повтор доступных персоналу заданий — WAITER и выше (WAITER/CASHIER видят только кухонные/барные чеки и предчеки — Z-отчёты и гостевые чеки видны только MANAGER+); управление самими принтерами — MANAGER и выше.

1. Любое действие печати (кухонный/барный чек, предчек, гостевой чек, Z-отчёт) сначала создаёт задание в очереди, только потом пытается его отправить — задание не теряется, даже если принтер недоступен.
2. Попытка соединения ограничена таймаутом ~2 секунды (настройка по умолчанию); если принтер не ответил — задание остаётся в статусе **Pending** и будет повторено автоматически фоновым процессом (по умолчанию каждую минуту), пока не будет достигнут предел попыток (по умолчанию 5), после чего статус становится **Failed**.
3. Неудавшиеся задания видны в очереди печати (по умолчанию открывается сразу с фильтром «Failed») и баннером на доске столов, если есть хотя бы одно.
4. Кнопка «Retry» у задания посылает ровно то же самое содержимое, что было сформировано изначально — не пересобирает документ заново из текущих данных заказа/меню/цен.
5. Само действие (отправка на кухню, печать предчека, закрытие заказа, закрытие смены) никогда не блокируется недоступностью принтера — печать всегда «в фоне», по принципу «лучшее из возможного», не мешая основной операции.

### 4.13 Заведение и изменение меню, столов, номеров, цен
**Роли:** просмотр — зависит от раздела (меню/столы — любой сотрудник; номера/цены/доступность — CASHIER+); создание/изменение/удаление — MANAGER и выше во всех случаях.

1. Формы создания и редактирования — одна и та же форма (переиспользуется), различие только в заголовке и кнопке («Create …» / «Save changes»).
2. Удаление всегда сначала проверяется на наличие связанных записей (брони/заказы/задания печати) — если они есть, удаление отклоняется с объяснением и предложением деактивировать вместо удаления («Edit → uncheck Active»).
3. Деактивированная запись (номер, стол, принтер, позиция меню) остаётся видна в истории и в старых записях, но перестаёт предлагаться для новых операций.
4. Цены задаются диапазоном дат поверх базовой цены типа номера («override») — не заменяют базовую цену навсегда, только на указанные даты; диапазон ограничен 366 днями за одну операцию.
5. Ручные блокировки номера (недоступность по не связанной с бронью причине — ремонт и т. п.) заводятся отдельно от цен/доступности брони, с обязательной причиной (свободный текст).

### 4.14 Управление сотрудниками и смена пароля
**Роли:** список/создание/роль/включение-выключение/сброс пароля — только ADMIN; смена собственного пароля — любая роль.

1. Создание сотрудника — email, временный пароль (минимум 8 символов), роль (по умолчанию в форме — MANAGER, но можно выбрать любую).
2. Администратор не может сменить собственную роль и не может выключить собственную учётную запись (защита от случайной самоблокировки) — эти действия для своей же учётной записи заблокированы явно.
3. Выключение учётной записи («Disable») сразу обрывает доступ по уже выданным токенам — не дожидаясь истечения срока их действия и не требуя, чтобы сотрудник вышел сам.
4. Сброс пароля администратором — не требует знания старого пароля (в отличие от самостоятельной смены), вводится через системный диалог ввода.
5. Смена роли, включение/выключение и сброс пароля — каждое из этих действий сразу делает недействительными все ранее выданные токены этого сотрудника (на всех устройствах), даже если срок их действия ещё не истёк.
6. Самостоятельная смена пароля (`/admin/account`) требует ввода текущего пароля; после смены сессия обновляется автоматически, повторный вход не требуется.

---

## 5. Что система намеренно не умеет

Проверено по коду и уточнено относительно исходного списка.

1. **Бронь нельзя удалить совсем** — только отменить (статус CANCELLED). В API нет операции удаления брони вообще.
2. **Частичная оплата заказа не поддерживается** — заказ закрывается ровно на свою текущую полную сумму одной операцией; сумму нельзя передать вручную и нельзя закрыть заказ несколькими платежами.
3. **Смену нельзя закрыть, пока в системе есть хоть один незакрытый заказ где угодно** — проверка не привязана к конкретной смене или кассиру: блокирует любой Open/Sent заказ у любого сотрудника.
4. **Неподтверждённые заявки с сайта отменяются автоматически** — по умолчанию через 2 «рабочих дня» простоя (без учёта выходных), с одним сводным письмом-напоминанием персоналу за один рабочий день до этого. Гостю о самой автоматической отмене не сообщается. Брони, заведённые персоналом со стойки, никогда не отменяются автоматически.
5. **Заметка об оплате, похожая на номер карты, отклоняется** — эвристика по длине цифровой последовательности (13–19 цифр) и проверке по алгоритму Луна; это эвристика, а не гарантия (редкий настоящий номер карты может проскочить, а случайный номер брони/чека похожей длины может быть отклонён).
6. **Офлайн-режима нет.** Явно зафиксировано в коде: ни одно действие не «делает вид», что сохранилось без сети — при обрыве соединения показывается отдельное сообщение («No connection — check the network and try again.»), а не тихий сбой.
7. **Начисления на номер (Room charge) не входят ни в одну цифру выручки на дашборде** — ни в «Room revenue (paid)», ни в «POS revenue collected». Показаны отдельной, явно подписанной суммой «Charged to rooms, not yet collected» — это перенос долга на счёт номера, а не полученные деньги.
8. **Оплата картой ничем не подтверждается извне** — «Card» это просто выбор способа оплаты кассиром; в системе нет интеграции ни с одним платёжным терминалом или платёжным шлюзом — успешность физической оплаты картой на месте система никак не проверяет и не может проверить.

Дополнительно, подтверждено по коду и стоит того же внимания:

9. **Нет отдельного статуса или действия «заселение» (check-in)/«выселение» (check-out).** Статусы брони — только NEW/CONFIRMED/PAID/CANCELLED. Проживает ли гость «прямо сейчас» — нигде не хранится отдельным флагом, определяется только тем, попадает ли сегодняшняя дата в период брони.
10. **Изменить дату/номер уже переселённой (relocated) брони одной формой нельзя.** После первого переселения дальнейшие изменения дат идут только по одной границе за раз (первый или последний сегмент), а смена номера в середине проживания — только через Undo + повторное Relocate.
11. **Печать «Retry» не пересобирает документ.** Повтор посылает то же самое содержимое, что было создано в момент исходной попытки — если за это время в заказе/меню/ценах что-то изменилось, чек всё равно уйдёт старым.
12. **Единственный способ убрать номер/стол/позицию меню/принтер из активного использования, если по нему уже есть история — деактивировать, не удалить.** Прямое удаление при наличии истории всегда отклоняется.
13. **У кассира без доступа менеджера нет возможности выбрать конкретный физический номер** при назначении/переселении — список физических номеров ему не показывается вовсе (доступно только «Unassigned»).
14. **Сессия входа держится по умолчанию 7 дней** (настройка `JWT_TTL_DAYS`), но досрочно аннулируется целиком (на всех устройствах сразу) при смене пароля, сбросе пароля администратором, смене роли или отключении учётной записи.
15. **Вход блокируется после 5 неудачных попыток** с одной пары (IP, email) на 15 минут; сообщение при этом одинаковое независимо от того, существует ли аккаунт, не существует или выключен — узнать это через форму входа нельзя.
16. **На телефоне (`/pos`) нет ПИН-кода на денежные действия** — есть только ручное «Not you? Switch» (выход) и автоматический выход после 30 минут отсутствия касаний/нажатий. Любое действие в системе привязывается исключительно к тому, кто сейчас вошёл в аккаунт на устройстве — «действовать от чужого имени, оставаясь в своей сессии» невозможно и никак не отслеживается отдельно.

---

## 6. Таблица прав

«✅» — доступно, «⚠️» — доступно с ограничением (см. сноску), «❌» — недоступно.

| Действие | WAITER | CASHIER | MANAGER | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Вход, смена собственного пароля | ✅ | ✅ | ✅ | ✅ |
| Доска столов/тикетов, создание заказов | ✅ | ✅ | ✅ | ✅ |
| Добавление/удаление позиций заказа, отправка на кухню | ✅ | ✅ | ✅ | ✅ |
| Отмена заказа | ✅ | ✅ | ✅ | ✅ |
| Печать предчека | ✅ | ✅ | ✅ | ✅ |
| Просмотр очереди печати, повтор своих заданий (кухня/бар/предчек) | ✅ | ✅ | ✅ | ✅ |
| Просмотр очереди печати целиком (+ Z-отчёты, гостевые чеки) | ❌ | ❌ | ✅ | ✅ |
| Просмотр меню и столов | ✅ | ✅ | ✅ | ✅ |
| Управление меню и столами (создать/изменить/удалить) | ❌ | ❌ | ✅ | ✅ |
| Управление принтерами, тестовая печать | ❌ | ❌ | ✅ | ✅ |
| Закрытие заказа (оплата: наличные/карта/на номер) | ❌ | ✅ | ✅ | ✅ |
| Открытие/закрытие собственной смены | ❌ | ✅ | ✅ | ✅ |
| Просмотр/экспорт любой смены, обзор смен по всем сотрудникам | ❌ | ⚠️ только своя, без экспорта | ✅ | ✅ |
| История заказов по всем сотрудникам/периоду | ❌ | ❌ | ✅ | ✅ |
| Просмотр списка/карточки брони, календаря | ❌ | ✅ | ✅ | ✅ |
| Создание брони со стойки | ❌ | ✅ | ✅ | ✅ |
| Изменение статуса/заметки об оплате брони | ❌ | ✅ | ✅ | ✅ |
| Изменение дат брони | ❌ | ✅ | ✅ | ✅ |
| Выбор конкретного физического номера (назначение/переселение) | ❌ | ⚠️ только снять назначение | ✅ | ✅ |
| Переселение брони (даты + тип номера) | ❌ | ✅ | ✅ | ✅ |
| Отмена переселения | ❌ | ✅ | ✅ | ✅ |
| Просмотр типов номеров, цен, доступности | ❌ | ✅ | ✅ | ✅ |
| Создание/изменение/удаление типов номеров, фото | ❌ | ❌ | ✅ | ✅ |
| Управление физическими номерами и ручными блокировками | ❌ | ❌ | ✅ | ✅ |
| Установка цен на диапазон дат | ❌ | ❌ | ✅ | ✅ |
| Экспорт CSV списка броней | ❌ | ❌ | ✅ | ✅ |
| Журнал действий персонала (History) | ❌ | ❌ | ✅ | ✅ |
| Сводка платежей (Payments summary) | ❌ | ❌ | ✅ | ✅ |
| Список сотрудников, роли, включение/выключение, сброс пароля | ❌ | ❌ | ❌ | ✅ |

Сноски: у CASHIER просмотр чужой смены по номеру возвращает «не найдено», а не «доступ запрещён» — чтобы нельзя было даже подтвердить существование чужой смены. Список физических номеров (`GET /room-units`) технически доступен на чтение с уровня WAITER на бэкенде, но ни один экран интерфейса не даёт роли ниже CASHIER/MANAGER путь к этому списку — на практике WAITER его нигде не видит.

---

## 7. Скриншоты

Папка: `docs/manual-screenshots/` (в этом репозитории). Все 20 сняты через локально поднятый стек (Postgres в Docker + backend на :8080 + frontend на :3000), Chromium/Playwright, под тестовой учётной записью `manual.qa.admin@sunsetbeach.example` (роль ADMIN — видит все экраны без ограничений роли). Мобильные экраны (`06`–`08`) сняты с реальной эмуляцией устройства (профиль «iPhone 13», 390×664, `isMobile`/`hasTouch` включены) — не просто узким окном; эмуляция сработала штатно, отдельно отмечать нечего.

Все имена/e-mail гостей и сотрудников на скриншотах — заведомо вымышленные тестовые записи (`QA …`, `Manual QA Guest …`, домен `@sunsetbeach.example`/`@example.com`), реальных персональных данных гостей в них нет. Тестовая бронь, созданная для съёмки (`Manual QA Guest Petrova`), после съёмки отменена (`CANCELLED`) — бронь нельзя удалить совсем, только отменить (см. §5, пункт 1). Тестовая учётная запись `manual.qa.admin@…`, созданная для входа при съёмке, после съёмки отключена (`Disabled`) и её пароль сброшен на случайное значение, которое нигде не сохранено, — удалить её совсем нельзя: на неё уже ссылаются созданные тестовые заказы/платежи/смены (внешние ключи `Order.openedByUserId` и т. п.), то же ограничение, что описано в §5 «единственный способ убрать что-то из активного использования — деактивировать».

| Файл | Экран | Примечания |
|---|---|---|
| [`01-login.png`](docs/manual-screenshots/01-login.png) | `/admin/login` — вход | |
| [`02-calendar.png`](docs/manual-screenshots/02-calendar.png) | `/admin/bookings/calendar` — календарь броней | видно несколько броней, включая переселённую (сегменты на строках 103 и 202) |
| [`03-booking-panel-relocate.png`](docs/manual-screenshots/03-booking-panel-relocate.png) | панель брони (клик по бару в календаре) с переселением | бронь с двумя сегментами — блок «Rooms» показывает обе комнаты и «Undo this relocation» |
| [`04-bookings-list.png`](docs/manual-screenshots/04-bookings-list.png) | `/admin/bookings` — список броней | записи разных статусов (NEW/CONFIRMED) |
| [`05-booking-detail-folio.png`](docs/manual-screenshots/05-booking-detail-folio.png) | `/admin/bookings/[id]` — страница брони со счётом | блок «Folio»: Room + Room charges (1) + Total due, не пустой |
| [`06-pos-mobile-home.png`](docs/manual-screenshots/06-pos-mobile-home.png) | `/pos` — главный экран зала на телефоне | мобильная эмуляция; виден баннер неудавшихся заданий печати и занятый стол |
| [`07-pos-mobile-order.png`](docs/manual-screenshots/07-pos-mobile-order.png) | `/pos/orders/[id]` — экран заказа на телефоне | статус Sent, предупреждение «Already sent», блок добавления позиций, блок оплаты |
| [`08-pos-mobile-payment.png`](docs/manual-screenshots/08-pos-mobile-payment.png) | оплата на телефоне (после нажатия «Cash») | карточка `PosAttributedConfirm` — «Close order — Cash», «Will be recorded as», «Confirm payment» |
| [`09-shift-open.png`](docs/manual-screenshots/09-shift-open.png) | `/admin/pos/shifts` — открытие смены | состояние без открытой смены, пустая форма «Open a shift» |
| [`10-shift-close-reconcile.png`](docs/manual-screenshots/10-shift-close-reconcile.png) | `/admin/pos/shifts` — закрытие смены со сверкой | Expected cash ฿4,620 / Counted cash ฿4,650 / Discrepancy +฿30 — намеренное расхождение |
| [`11-print-queue-failed.png`](docs/manual-screenshots/11-print-queue-failed.png) | `/admin/pos/print-jobs` — очередь печати с неудавшимся заданием | фильтр по умолчанию Failed, задания с «5 attempts · Connect timed out» |
| [`12-order-history.png`](docs/manual-screenshots/12-order-history.png) | `/admin/pos/orders` — список закрытых заказов | несколько заказов, статусы PAID/CANCELLED, разные способы оплаты |
| [`13-menu-manage.png`](docs/manual-screenshots/13-menu-manage.png) | `/admin/pos/menu` — управление меню | |
| [`14-tables-manage.png`](docs/manual-screenshots/14-tables-manage.png) | `/admin/pos` → «Manage tables» — управление столами | блок управления столами развёрнут |
| [`15-rooms-manage.png`](docs/manual-screenshots/15-rooms-manage.png) | `/admin/rooms` — управление номерами | |
| [`16-pricing.png`](docs/manual-screenshots/16-pricing.png) | `/admin/pricing` — управление ценами | |
| [`17-printers.png`](docs/manual-screenshots/17-printers.png) | `/admin/pos/printers` — управление принтерами | |
| [`18-users.png`](docs/manual-screenshots/18-users.png) | `/admin/users` — список сотрудников | |
| [`19-history.png`](docs/manual-screenshots/19-history.png) | `/admin/history` — журнал действий | |
| [`20-dashboard.png`](docs/manual-screenshots/20-dashboard.png) | `/admin` — дашборд | |

---

## 8. Что в коде выглядит недоделанным или противоречивым

Список без сглаживания — как есть в коде на момент сборки.

1. **Поиск брони для «начисления на номер» находит только статус CONFIRMED**, а не «CONFIRMED или PAID» (`RoomChargeLink.tsx`, `lib/pos/bookingSearchClient.ts`, backend-фильтр `status=CONFIRMED`). Если бронь уже отметили статусом PAID (например, гость оплатил проживание заранее целиком), при этом гость всё ещё физически проживает — начислить на неё заказ из бара/ресторана через этот поиск уже не получится, бронь просто не появится в списке/поиске. Собственный комментарий в коде (`RoomChargeLink.tsx`) прямо признаёт неопределённость: «Whether from/to means checkIn falls in this range or range overlaps the stay wasn't confirmed... Flagged in the implementation summary; not something the frontend can fix alone.» — то есть это открытый вопрос, а не осознанное ограничение.
2. **Статус брони и статус заказа показаны по-разному без видимой причины.** Статус заказа переведён в подписи («Open», «Paid» …), статус брони — нет (на экране всегда сырое `NEW`/`CONFIRMED`/`PAID`/`CANCELLED`). Обе сущности используют одинаковое по смыслу слово `PAID`, но выглядит оно по-разному в двух разных списках.
3. **Подтверждение личности перед оплатой (`PosAttributedConfirm`) есть только на телефоне**, у тех же самых операций (закрытие заказа, закрытие смены) на десктопной админке — нет: там кнопка сразу выполняет действие. Если админкой на ресепшене реально пользуется кассир (что явно предполагается ролью CASHIER на этом экране), несовпадение в строгости между двумя интерфейсами для одного и того же действия ничем не объяснено в коде.
4. **Кнопка «Remove» у фотографии номера** (`RoomImageUploader.tsx`) — единственное удаляющее действие в интерфейсе вообще без подтверждения (ни `window.confirm`, ни что-либо ещё); все остальные операции удаления запрашивают подтверждение.
5. **`GET /room-units` доступен на чтение с роли WAITER на бэкенде** (`SecurityConfig.java`), но ни одна страница, доступная WAITER, этим не пользуется — на практике этот уровень доступа никак не задействован интерфейсом.
6. Один и тот же контрол «часы работы» подтверждения переселения показывает **разный набор полей в зависимости от роли** (MANAGER+ видит выбор конкретного физического номера, CASHIER — нет), но текст подсказки под полем («Only managers can list rooms to switch to a different one...») появляется только в одной из двух похожих форм (`BookingScheduleForm.tsx`), а в панели брони (`BookingCardPanel.tsx`) поле для CASHIER просто не рендерится вовсе, без объясняющей надписи на месте.
7. Экспорт CSV смены и просмотр «Orders in this shift» на **странице отчёта конкретной смены** (`/admin/pos/shifts/[id]`) требуют MANAGER+ — при том что саму страницу разрешено открыть CASHIER (для собственной смены). То есть кассир видит итоговые цифры своей смены, но не может ни выгрузить их, ни посмотреть список заказов, из которых они сложились — эти же данные при этом доступны кассиру постранично на мобильном экране `/pos/orders?shiftId=…`, только не с десктопа.
