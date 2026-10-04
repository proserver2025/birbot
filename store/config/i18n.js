// Three-language UI dictionary (az / ru / en) for the customer-facing
// storefront. Admin panel stays Azerbaijani-only (internal staff tool).
const dict = {
  // --- Header / nav ---
  'nav.search_placeholder': { az: 'Məhsul axtar...', ru: 'Поиск товара...', en: 'Search products...' },
  'nav.search_btn': { az: 'Axtar', ru: 'Искать', en: 'Search' },
  'nav.partner': { az: 'Tərəfdaşlıq', ru: 'Партнёрство', en: 'Partners' },
  'nav.logout': { az: 'Çıxış', ru: 'Выход', en: 'Log out' },
  'nav.login': { az: 'Giriş', ru: 'Вход', en: 'Log in' },
  'nav.register': { az: 'Qeydiyyat', ru: 'Регистрация', en: 'Sign up' },
  'nav.cart': { az: 'Səbət', ru: 'Корзина', en: 'Cart' },
  'nav.all_products': { az: 'Bütün məhsullar', ru: 'Все товары', en: 'All products' },
  'nav.products_short': { az: 'Məhsullar', ru: 'Товары', en: 'Products' },
  'nav.about': { az: 'Haqqımızda', ru: 'О нас', en: 'About us' },

  // --- Footer ---
  'footer.about_title': { az: 'SaaS Home', ru: 'SaaS Home', en: 'SaaS Home' },
  'footer.about_text': {
    az: 'Mətbəx əşyaları, məişət texnikası və ev əşyaları üzrə etibarlı online mağaza.',
    ru: 'Надёжный интернет-магазин кухонной утвари, бытовой техники и товаров для дома.',
    en: 'A trusted online store for kitchenware, home appliances and household goods.',
  },
  'footer.links_title': { az: 'Keçidlər', ru: 'Ссылки', en: 'Links' },
  'footer.contact_title': { az: 'Əlaqə', ru: 'Контакты', en: 'Contact' },
  'footer.follow_title': { az: 'Bizi izləyin', ru: 'Подпишитесь', en: 'Follow us' },
  'footer.rights': {
    az: 'Bütün hüquqlar qorunur.',
    ru: 'Все права защищены.',
    en: 'All rights reserved.',
  },
  'footer.made_by': { az: 'Saytı hazırladı', ru: 'Сайт разработан', en: 'Site built by' },

  'page.home_title': { az: 'Ana səhifə', ru: 'Главная', en: 'Home' },

  // --- Home page ---
  'home.hero_eyebrow': { az: 'Topdan və pərakəndə satış', ru: 'Опт и розница', en: 'Wholesale & retail' },
  'home.hero_title': {
    az: 'Evinizə lazım olan hər şey, bir ünvanda',
    ru: 'Всё необходимое для вашего дома — в одном месте',
    en: 'Everything your home needs, in one place',
  },
  'home.hero_text': {
    az: 'Keyfiyyətli mətbəx əşyaları, məişət texnikası və ev əşyaları — rahat çatdırılma ilə qapınıza qədər.',
    ru: 'Качественная кухонная утварь, бытовая техника и товары для дома — с удобной доставкой до двери.',
    en: 'Quality kitchenware, home appliances and household goods — delivered right to your door.',
  },
  'home.hero_cta': { az: 'Alış-verişə başla', ru: 'Начать покупки', en: 'Start shopping' },
  'home.categories_title': { az: 'Kateqoriyalar', ru: 'Категории', en: 'Categories' },
  'home.featured_title': { az: 'Seçilmiş məhsullar', ru: 'Избранные товары', en: 'Featured products' },
  'home.view_all': { az: 'Hamısına bax →', ru: 'Смотреть все →', en: 'View all →' },
  'home.new_arrivals_title': { az: 'Yeni əlavələr', ru: 'Новинки', en: 'New arrivals' },

  // --- Products / category ---
  'products.title': { az: 'Bütün məhsullar', ru: 'Все товары', en: 'All products' },
  'products.search_prefix': { az: 'Axtarış', ru: 'Поиск', en: 'Search' },
  'products.empty': { az: 'Heç bir məhsul tapılmadı.', ru: 'Товары не найдены.', en: 'No products found.' },
  'category.empty': { az: 'Bu kateqoriyada hələ məhsul yoxdur.', ru: 'В этой категории пока нет товаров.', en: 'There are no products in this category yet.' },
  'products.add_to_cart': { az: 'Səbətə at', ru: 'В корзину', en: 'Add to cart' },
  'products.in_stock': { az: 'Stokda var', ru: 'В наличии', en: 'In stock' },
  'products.out_of_stock': { az: 'Stokda yoxdur', ru: 'Нет в наличии', en: 'Out of stock' },
  'products.pieces': { az: 'ədəd', ru: 'шт.', en: 'pcs' },
  'products.no_image': { az: 'Şəkil yoxdur', ru: 'Нет изображения', en: 'No image' },

  // --- Product detail ---
  'product.related_title': { az: 'Bənzər məhsullar', ru: 'Похожие товары', en: 'Related products' },
  'product.qty': { az: 'Say', ru: 'Кол-во', en: 'Qty' },

  // --- Cart ---
  'cart.title': { az: 'Səbətim', ru: 'Моя корзина', en: 'My cart' },
  'cart.empty': { az: 'Səbətiniz boşdur.', ru: 'Ваша корзина пуста.', en: 'Your cart is empty.' },
  'cart.start_shopping': { az: 'Alış-verişə başla', ru: 'Начать покупки', en: 'Start shopping' },
  'cart.col_product': { az: 'Məhsul', ru: 'Товар', en: 'Product' },
  'cart.col_price': { az: 'Qiymət', ru: 'Цена', en: 'Price' },
  'cart.col_qty': { az: 'Say', ru: 'Кол-во', en: 'Qty' },
  'cart.col_total': { az: 'Cəm', ru: 'Итого', en: 'Total' },
  'cart.remove': { az: 'Sil', ru: 'Удалить', en: 'Remove' },
  'cart.subtotal': { az: 'Məhsul cəmi', ru: 'Сумма товаров', en: 'Items subtotal' },
  'cart.need_account_title': { az: 'Sifariş vermək üçün qeydiyyatdan keçin', ru: 'Зарегистрируйтесь, чтобы оформить заказ', en: 'Sign up to place an order' },
  'cart.need_account_text': {
    az: 'Qısadır — ad, email, telefon, parol. Google ilə də bir kliklə ola bilər.',
    ru: 'Это быстро — имя, email, телефон, пароль. Также можно одним кликом через Google.',
    en: "It's quick — name, email, phone, password. One click with Google works too.",
  },
  'cart.need_phone_title': { az: 'Telefon nömrənizi tamamlayın', ru: 'Укажите номер телефона', en: 'Complete your phone number' },
  'cart.need_phone_text': {
    az: 'Sifariş vermədən əvvəl bir dəfəlik telefon nömrənizi əlavə etməlisiniz.',
    ru: 'Перед заказом нужно один раз указать номер телефона.',
    en: 'You need to add your phone number once before placing an order.',
  },
  'cart.need_phone_continue': { az: 'Davam et', ru: 'Продолжить', en: 'Continue' },
  'cart.checkout_title': { az: 'Sifarişi tamamla', ru: 'Оформить заказ', en: 'Complete order' },
  'cart.full_name': { az: 'Ad, Soyad', ru: 'Имя, фамилия', en: 'Full name' },
  'cart.phone': { az: 'Telefon', ru: 'Телефон', en: 'Phone' },
  'cart.address': { az: 'Çatdırılma ünvanı', ru: 'Адрес доставки', en: 'Delivery address' },
  'cart.zone': { az: 'Çatdırılma zonası', ru: 'Зона доставки', en: 'Delivery zone' },
  'cart.warranty_label': { az: 'Zəmanət talonu əlavə et', ru: 'Добавить гарантийный талон', en: 'Add warranty card' },
  'cart.bonus_use': { az: 'Bonusdan istifadə et', ru: 'Использовать бонусы', en: 'Use bonus balance' },
  'cart.bonus_available': { az: 'mövcuddur', ru: 'доступно', en: 'available' },
  'cart.shipping': { az: 'Çatdırılma', ru: 'Доставка', en: 'Shipping' },
  'cart.warranty': { az: 'Zəmanət', ru: 'Гарантия', en: 'Warranty' },
  'cart.grand_total': { az: 'Ümumi', ru: 'Итого к оплате', en: 'Grand total' },
  'cart.confirm_btn': { az: 'Sifarişi təsdiqlə', ru: 'Подтвердить заказ', en: 'Confirm order' },
  'cart.zone_placeholder': { az: '— seçin —', ru: '— выберите —', en: '— select —' },
  'cart.zone_city_group': { az: 'Bakı daxili', ru: 'По Баку', en: 'Within Baku' },
  'cart.zone_region_group': { az: 'Rayonlar', ru: 'Районы', en: 'Regions' },
  'cart.zone_note': {
    az: 'Çatdırılma qiyməti bir sifarişə görədir (neçə məhsul olmasından asılı olmayaraq) — hamısı birlikdə göndərilir.',
    ru: 'Стоимость доставки фиксирована за весь заказ (независимо от количества товаров) — всё отправляется вместе.',
    en: "Shipping is a flat fee per order (regardless of item count) — everything ships together.",
  },
  'cart.warranty_want': { az: 'Zəmanət talonu istəyirəm', ru: 'Хочу гарантийный талон', en: 'I want a warranty card' },
  'cart.bonus_use_label': { az: 'Bonus balansından istifadə et', ru: 'Использовать бонусный баланс', en: 'Use my bonus balance' },
  'cart.payable': { az: 'Ödəniləcək', ru: 'К оплате', en: 'Payable' },
  'cart.bonus_discount': { az: 'Bonus endirimi', ru: 'Скидка за счёт бонусов', en: 'Bonus discount' },

  // --- Account ---
  'account.title': { az: 'Hesabım', ru: 'Мой профиль', en: 'My account' },
  'account.bonus_available': { az: 'Bonus balansı (istifadəyə hazır)', ru: 'Бонусный баланс (доступно)', en: 'Bonus balance (available)' },
  'account.bonus_pending': { az: 'Gözləmədə', ru: 'В ожидании', en: 'Pending' },
  'account.bonus_days': { az: 'gün', ru: 'дней', en: 'days' },
  'account.bonus_explain': {
    az: 'Hər aldığınız məhsulun bir hissəsi bonus kimi geri qayıdır (sifarişin məhsul dəyərinin faizi), növbəti sifarişdə qiymətdən çıxıla bilər.',
    ru: 'Часть стоимости каждой покупки возвращается в виде бонуса (процент от суммы товаров) и может быть использована при следующем заказе.',
    en: 'A share of every purchase comes back as a bonus (a percentage of the item total) that you can redeem on your next order.',
  },
  'account.partner_link': { az: 'Tərəfdaşlıq proqramı', ru: 'партнёрской программы', en: 'partner program' },
  'account.partner_explain_suffix': {
    az: 'ilə isə linkinizi paylaşıb ayrıca komissiya qazana bilərsiniz.',
    ru: 'вы можете делиться своей ссылкой и получать отдельную комиссию.',
    en: 'you can also share your own link and earn a separate commission.',
  },
  'account.orders_title': { az: 'Sifariş tarixçəm', ru: 'История заказов', en: 'My order history' },
  'account.no_orders': { az: 'Hələ sifarişiniz yoxdur.', ru: 'У вас пока нет заказов.', en: "You don't have any orders yet." },
  'account.col_no': { az: '№', ru: '№', en: 'No.' },
  'account.col_date': { az: 'Tarix', ru: 'Дата', en: 'Date' },
  'account.col_amount': { az: 'Məbləğ', ru: 'Сумма', en: 'Amount' },
  'account.col_bonus': { az: 'Bonus', ru: 'Бонус', en: 'Bonus' },
  'account.col_status': { az: 'Status', ru: 'Статус', en: 'Status' },

  // --- Order detail ---
  'order.title_prefix': { az: 'Sifariş', ru: 'Заказ', en: 'Order' },
  'order.back_to_account': { az: '← Hesabıma qayıt', ru: '← Назад в профиль', en: '← Back to my account' },
  'order.date': { az: 'Tarix', ru: 'Дата', en: 'Date' },
  'order.address': { az: 'Ünvan', ru: 'Адрес', en: 'Address' },
  'order.total': { az: 'Ümumi məbləğ', ru: 'Итоговая сумма', en: 'Order total' },
  'order.status': { az: 'Status', ru: 'Статус', en: 'Status' },
  'order.tracking_title': { az: 'Çatdırılma izləməsi', ru: 'Отслеживание доставки', en: 'Delivery tracking' },
  'order.tracking_empty': {
    az: 'Sifarişiniz hazırlanır, tezliklə burada izləmə məlumatı görünəcək.',
    ru: 'Ваш заказ готовится, информация об отслеживании появится здесь позже.',
    en: 'Your order is being prepared — tracking updates will appear here soon.',
  },
  'order.chat_title': { az: 'Mağaza ilə çat', ru: 'Чат с магазином', en: 'Chat with the store' },
  'order.chat_hint': {
    az: 'Kuryerə ünvanı dəqiqləşdirmək üçün buradan konumunuzu paylaşa bilərsiniz.',
    ru: 'Здесь вы можете поделиться своим местоположением, чтобы курьер точнее нашёл адрес.',
    en: 'You can share your location here so the courier can find the address more easily.',
  },
  'order.chat_empty': { az: 'Hələ mesaj yoxdur. Sual varsa, bura yazın.', ru: 'Пока нет сообщений. Если есть вопрос — напишите здесь.', en: 'No messages yet. Write here if you have a question.' },
  'order.chat_placeholder': { az: 'Mesajınızı yazın...', ru: 'Напишите сообщение...', en: 'Type your message...' },
  'order.chat_send': { az: 'Göndər', ru: 'Отправить', en: 'Send' },
  'order.location_sent': { az: 'Konum paylaşıldı', ru: 'Местоположение отправлено', en: 'Location shared' },
  'order.location_view': { az: 'xəritədə bax', ru: 'посмотреть на карте', en: 'view on map' },
  'order.location_no_geo': { az: 'Bu cihazda konum paylaşımı mümkün deyil.', ru: 'На этом устройстве геолокация недоступна.', en: 'Location sharing is not available on this device.' },
  'order.location_getting': { az: 'Konum alınır...', ru: 'Получение местоположения...', en: 'Getting location...' },
  'order.location_denied': { az: 'Konuma icazə verilmədi.', ru: 'Доступ к местоположению не разрешён.', en: 'Location access was denied.' },
  'order.location_btn_title': { az: 'Konumu göndər', ru: 'Отправить местоположение', en: 'Send location' },

  // --- Auth: login / register / add-phone ---
  'auth.login_title': { az: 'Giriş', ru: 'Вход', en: 'Log in' },
  'auth.email': { az: 'Email', ru: 'Email', en: 'Email' },
  'auth.password': { az: 'Parol', ru: 'Пароль', en: 'Password' },
  'auth.login_btn': { az: 'Daxil ol', ru: 'Войти', en: 'Log in' },
  'auth.or': { az: 'və ya', ru: 'или', en: 'or' },
  'auth.google_btn': { az: 'Google ilə daxil ol', ru: 'Войти через Google', en: 'Continue with Google' },
  'auth.no_account': { az: 'Hesabınız yoxdur?', ru: 'Нет аккаунта?', en: "Don't have an account?" },
  'auth.register_link': { az: 'Qeydiyyatdan keçin', ru: 'Зарегистрироваться', en: 'Sign up' },
  'auth.register_title': { az: 'Qeydiyyat', ru: 'Регистрация', en: 'Sign up' },
  'auth.full_name': { az: 'Ad, Soyad', ru: 'Имя, фамилия', en: 'Full name' },
  'auth.phone': { az: 'Telefon', ru: 'Телефон', en: 'Phone' },
  'auth.register_btn': { az: 'Qeydiyyatdan keç', ru: 'Зарегистрироваться', en: 'Create account' },
  'auth.have_account': { az: 'Artıq hesabınız var?', ru: 'Уже есть аккаунт?', en: 'Already have an account?' },
  'auth.login_link': { az: 'Daxil olun', ru: 'Войти', en: 'Log in' },
  'auth.phone_title': { az: 'Telefon nömrənizi əlavə edin', ru: 'Укажите номер телефона', en: 'Add your phone number' },
  'auth.phone_text': {
    az: 'Sifariş vermək üçün telefon nömrəniz mütləqdir.',
    ru: 'Номер телефона обязателен для оформления заказа.',
    en: 'A phone number is required to place an order.',
  },
  'auth.phone_save_btn': { az: 'Yadda saxla və davam et', ru: 'Сохранить и продолжить', en: 'Save and continue' },

  // --- Partner page ---
  'partner.title': { az: 'Tərəfdaşlıq proqramı', ru: 'Партнёрская программа', en: 'Partner program' },
  'partner.balance': { az: 'Çıxarıla bilən balans', ru: 'Доступный к выводу баланс', en: 'Withdrawable balance' },
  'partner.pending': { az: 'Gözləmədə', ru: 'В ожидании', en: 'Pending' },
  'partner.referrals': { az: 'Referanslar', ru: 'Рефералы', en: 'Referrals' },
  'partner.your_link': { az: 'Sənin referral linkin', ru: 'Ваша реферальная ссылка', en: 'Your referral link' },
  'partner.copy': { az: 'Kopyala', ru: 'Копировать', en: 'Copy' },
  'partner.code_label': { az: 'Kod', ru: 'Код', en: 'Code' },
  'partner.payout_btn': { az: 'Çıxarış sorğusu göndər', ru: 'Запросить вывод', en: 'Request payout' },
  'partner.history_title': { az: 'Çıxarış sorğuların', ru: 'История выводов', en: 'Payout history' },
  'partner.explain': {
    az: 'Öz linkini paylaş — kimsə o link üzərindən bizdən məhsul alsa, satışın {pct}%-i sənin balansına yazılır. Pul {days} gün sonra (qaytarma müddəti bitəndən sonra) "təmizlənir" və çıxarıla bilən olur. Balansın {threshold} ₼-ə çatanda çıxarış sorğusu göndərə bilərsən.',
    ru: 'Делитесь своей ссылкой — если кто-то купит у нас по этой ссылке, {pct}% от суммы продажи зачисляется на ваш баланс. Через {days} дней (после окончания срока возврата) сумма "очищается" и становится доступной для вывода. Когда баланс достигнет {threshold} ₼, вы можете запросить вывод.',
    en: "Share your link — when someone buys through it, {pct}% of the sale is credited to your balance. After {days} days (once the return window closes) it clears and becomes withdrawable. Once your balance reaches {threshold} ₼ you can request a payout.",
  },
  'partner.withdrawable_balance': { az: 'Çıxarıla bilən balans', ru: 'Доступный к выводу баланс', en: 'Withdrawable balance' },
  'partner.paid_so_far': { az: 'İndiyədək ödənilib', ru: 'Выплачено на сегодня', en: 'Paid out so far' },
  'partner.withdraw_title': { az: 'Çıxarış', ru: 'Вывод средств', en: 'Withdrawal' },
  'partner.withdraw_ready': { az: 'Balansın ({amount} ₼) çıxarış üçün hazırdır.', ru: 'Ваш баланс ({amount} ₼) готов к выводу.', en: 'Your balance ({amount} ₼) is ready to withdraw.' },
  'partner.withdraw_min': {
    az: 'Minimum {threshold} ₼ olmalıdır. Hələ {remaining} ₼ qalıb.',
    ru: 'Минимум должен составлять {threshold} ₼. Осталось накопить {remaining} ₼.',
    en: 'Minimum is {threshold} ₼. You still need {remaining} ₼ more.',
  },
  'partner.referred_orders_title': { az: 'Gətirdiyin sifarişlər', ru: 'Приведённые заказы', en: 'Orders you referred' },
  'partner.col_product_amount': { az: 'Məhsul məbləği', ru: 'Сумма товаров', en: 'Item amount' },
  'partner.col_commission': { az: 'Komissiya', ru: 'Комиссия', en: 'Commission' },
  'partner.col_amount': { az: 'Məbləğ', ru: 'Сумма', en: 'Amount' },

  // --- Order confirmation ---
  'done.title': { az: '✅ Sifariş qəbul olundu!', ru: '✅ Заказ принят!', en: '✅ Order received!' },
  'done.order_no': { az: 'Sifariş nömrəniz', ru: 'Номер вашего заказа', en: 'Your order number' },
  'done.paid': { az: 'Ödənilib', ru: 'Оплачено', en: 'Paid' },
  'done.bonus_note': {
    az: 'Bu sifarişə görə bonus balansınıza kəşbek yazılacaq (15 gün ərzində təsdiqlənəcək).',
    ru: 'За этот заказ на ваш бонусный баланс будет начислен кешбэк (подтвердится в течение 15 дней).',
    en: 'A cashback bonus will be credited to your balance for this order (confirmed within 15 days).',
  },
  'done.text': {
    az: 'Tezliklə sizinlə əlaqə saxlanılacaq.',
    ru: 'Мы скоро с вами свяжемся.',
    en: "We'll be in touch with you soon.",
  },
  'done.view_order': { az: 'Sifarişə bax', ru: 'Посмотреть заказ', en: 'View order' },
  'done.back_home': { az: 'Ana səhifəyə qayıt', ru: 'На главную', en: 'Back to home' },

  // --- Order / bonus status labels ---
  'status.yeni': { az: 'yeni', ru: 'новый', en: 'new' },
  'status.hazirlanir': { az: 'hazırlanır', ru: 'готовится', en: 'preparing' },
  'status.gonderildi': { az: 'göndərildi', ru: 'отправлен', en: 'shipped' },
  'status.tamamlandi': { az: 'tamamlandı', ru: 'выполнен', en: 'completed' },
  'status.legv_edildi': { az: 'ləğv edildi', ru: 'отменён', en: 'cancelled' },
  'status.pending': { az: 'gözləmədə', ru: 'в ожидании', en: 'pending' },
  'status.settled': { az: 'balansda', ru: 'на балансе', en: 'settled' },
  'status.none': { az: '—', ru: '—', en: '—' },
  'status.gozleyir': { az: 'gözləyir', ru: 'в ожидании', en: 'pending' },
  'status.temizlendi': { az: 'təmizləndi', ru: 'зачислено', en: 'cleared' },
  'status.odenildi': { az: 'ödənildi', ru: 'выплачено', en: 'paid' },

  // --- About page ---
  'about.title': { az: 'Biz kimik', ru: 'Кто мы', en: 'Who we are' },
  'about.p1': {
    az: 'SaaS Home — Azərbaycanda ev və mətbəx əşyaları, elektrik məişət texnikası sahəsində fəaliyyət göstərən onlayn pərakəndə mağazadır. Məqsədimiz sadədir: etibarlı məhsulları, şəffaf qiymətlə və sürətli çatdırılma ilə birbaşa sizin evinizə çatdırmaq.',
    ru: 'SaaS Home — это интернет-магазин товаров для дома, кухонной утвари и бытовой электротехники в Азербайджане. Наша цель проста: доставлять надёжные товары по честной цене и быстро — прямо к вам домой.',
    en: 'SaaS Home is an online retail store in Azerbaijan for home and kitchen goods and electrical appliances. Our goal is simple: bring reliable products, at a transparent price, with fast delivery, straight to your home.',
  },
  'about.p2': {
    az: 'Həm fərdi müştərilər, həm də topdan sifariş verən biznes tərəfdaşları üçün işləyirik. Kataloqumuz daim yenilənir, admin komandamız hər məhsulu diqqətlə seçir ki, siz yalnız yoxlanılmış, keyfiyyətli məhsulla qarşılaşasınız.',
    ru: 'Мы работаем как с частными покупателями, так и с бизнес-партнёрами, делающими оптовые заказы. Наш каталог постоянно обновляется, и команда тщательно отбирает каждый товар, чтобы вы получали только проверенное качество.',
    en: 'We work with both individual customers and business partners placing wholesale orders. Our catalog is constantly updated, and our team carefully selects every product so you only see verified, quality goods.',
  },
  'about.tag_retail': { az: 'Pərakəndə', ru: 'Розница', en: 'Retail' },
  'about.tag_retail_sub': { az: '& topdan satış', ru: 'и оптовая продажа', en: '& wholesale' },
  'about.tag_baku': { az: 'Bakı', ru: 'Баку', en: 'Baku' },
  'about.tag_baku_sub': { az: 'və bölgələrə çatdırılma', ru: 'и доставка по регионам', en: 'and regional delivery' },
  'about.contact_title': { az: 'Əlaqə məlumatları', ru: 'Контактная информация', en: 'Contact details' },
  'about.phone': { az: 'Telefon', ru: 'Телефон', en: 'Phone' },
  'about.email': { az: 'E-poçt', ru: 'Эл. почта', en: 'Email' },
  'about.social': { az: 'Sosial media', ru: 'Соцсети', en: 'Social media' },
  'about.why_title': { az: 'Niyə SaaS Home?', ru: 'Почему SaaS Home?', en: 'Why SaaS Home?' },
  'about.why_1': { az: 'Yoxlanılmış keyfiyyət', ru: 'Проверенное качество', en: 'Verified quality' },
  'about.why_2': { az: 'Şəffaf qiymət', ru: 'Честная цена', en: 'Transparent pricing' },
  'about.why_3': { az: 'Sürətli çatdırılma', ru: 'Быстрая доставка', en: 'Fast delivery' },
  'about.why_4': { az: 'Topdan sifariş imkanı', ru: 'Возможность опта', en: 'Wholesale orders available' },

  // --- Errors ---
  'error.404_title': { az: 'Tapılmadı', ru: 'Страница не найдена', en: 'Not found' },
  'error.404_text': { az: 'Axtardığınız səhifə mövcud deyil.', ru: 'Запрошенная страница не существует.', en: "The page you're looking for doesn't exist." },
  'error.403_title': { az: 'Qadağan olundu', ru: 'Доступ запрещён', en: 'Forbidden' },
  'error.403_text': {
    az: 'Sorğu etibarsızdır və ya vaxtı keçib (CSRF). Zəhmət olmasa səhifəni yeniləyib yenidən cəhd edin.',
    ru: 'Запрос недействителен или истёк срок его действия (CSRF). Обновите страницу и попробуйте снова.',
    en: 'The request is invalid or has expired (CSRF). Please refresh the page and try again.',
  },
  'error.home_link': { az: 'Ana səhifəyə qayıt', ru: 'На главную', en: 'Back to home' },
  'error.generic_title': { az: 'Xəta', ru: 'Ошибка', en: 'Error' },
};

const LOCALES = ['az', 'ru', 'en'];
const DEFAULT_LOCALE = 'az';

function translate(locale, key, vars) {
  const entry = dict[key];
  let text = entry ? entry[locale] || entry[DEFAULT_LOCALE] || key : key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    });
  }
  return text;
}

function readLangCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(';').map((p) => p.trim()).find((p) => p.startsWith('lang='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

// Reads ?lang=xx (persists to a cookie) or falls back to the stored
// cookie, defaulting to Azerbaijani. Exposes res.locals.t()/lang for EJS.
function i18nMiddleware(req, res, next) {
  let locale = req.query.lang && LOCALES.includes(req.query.lang) ? req.query.lang : readLangCookie(req);
  if (!LOCALES.includes(locale)) locale = DEFAULT_LOCALE;
  if (req.query.lang && LOCALES.includes(req.query.lang)) {
    res.cookie('lang', locale, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
  }
  res.locals.lang = locale;
  res.locals.t = (key, vars) => translate(locale, key, vars);
  next();
}

module.exports = { i18nMiddleware, translate, LOCALES, DEFAULT_LOCALE };
