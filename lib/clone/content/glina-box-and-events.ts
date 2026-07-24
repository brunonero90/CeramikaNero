import type { SplitBlock } from '@/components/clone/marketing';

/** Full archived GLINA BOX long-form page (/home). */
export const glinaBoxPage = {
  title: 'GLINA BOX | Pracownia Ceramiki N',
  metaDescription:
    'Stwórz wiosenną podstawkę własnymi rękami! BOX CERAMICZNY – Twój pierwszy krok w świat ceramiki.',
  hero: {
    title: 'GLINA BOX',
    imageSrc:
      '/images/wix-migrated/747d6f_3a7f8f99735746e78d72aac1681f6b85.jpg',
    imageAlt: 'PHOTO-2026-03-16-11-51-54_6.jpg',
    logoSrc: '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png',
    intro: ['Stwórz wiosenną podstawkę', 'własnymi rękami!'],
  },
  bannerSrc:
    '/images/wix-migrated/11062b_be1dfb50b09647ba9eaf0c6bdd4923dff000.jpg',
  introBlocks: [
    'BOX CERAMICZNY – Twój pierwszy krok w świat ceramiki',
    'Stworzony z pasji do gliny, nasz box pozwala w domowym zaciszu wykonać własną, świąteczną podstawkę lub miseczkę.',
    'Do zestawu dołączony jest FILM INSTUKTAŻOWY krok po kroku oraz wszystkie niezbędne narzędzia.',
    'Opcjonalnie możesz wysłać swoją pracę do naszej pracowni, a my ją profesjonalnie wypalimy.',
  ],
  giftBannerAlt: 'WYJĄTKOWY PREZENT',
  giftBannerSrc:
    '/images/wix-migrated/747d6f_632dd58fd1e5410496220f95241a4bbc.jpg',
  primaryCta: {
    label: 'Zamawiam z kursem krok po kroku',
    href: '/sklep',
  },
  breath: {
    title: 'Chwila oddechu...',
    paragraphs: [
      'Pomaga zwolnić i zrobić coś tylko dla siebie — w atmosferze ciepła, spokoju i kreatywności.',
      'Dla kogo sprawdzi się najlepiej:',
    ],
    bullets: [
      'dla osób potrzebujących odpoczynku i wyciszenia',
      'dla zapracowanych, aby na chwilę oderwać głowę',
      'dla tych, którzy chcą poczuć magię tworzenia',
      'dla osób szukających wyjątkowego prezentu',
    ],
    imageSrc:
      '/images/wix-migrated/747d6f_2a8c8e6e4b03466e945f9536100cdc68.jpg',
    imageAlt: 'PHOTO-2026-01-20-13-57-34.jpg',
    ctaLabel: 'Chcę to poczuć!',
    ctaHref: '/sklep',
  },
  course: {
    title: 'Kurs krok po kroku',
    paragraphs: [
      'KURS GLINA BOX poprowadzi Cię za rękę, nawet jeśli nigdy wcześniej nie lepiłaś.',
      'Dlaczego to pokochasz:',
    ],
    bullets: [
      'miękka, gotowa do użycia glina, stworzona do formowania w domowych warunkach',
      'komplet narzędzi do lepienia i dekorowania',
      'film krok po kroku z instrukcją tworzenia',
      'tworzenie bez stresu, idealne na spokojny, świąteczny wieczór.',
    ],
    imageSrc:
      '/images/wix-migrated/747d6f_0fe41123a0a34078b88b14d085b6b727.jpg',
    imageAlt: 'PHOTO-2026-02-04-20-06-56 (1).jpg',
    ctaLabel: 'Chcę spróbować!',
    ctaHref: '/sklep',
  },
  products: [
    {
      id: 'szkliwienie',
      badge: 'Nowość',
      title: 'SZKLIWIENIE PRAC W PRACOWNI CERAMIKA NERO',
      priceLabel: 'Cena',
      price: '69,00 zł',
      href: '/product-page/szkliwienie-prac-w-pracowni-ceramika-nero-1',
      imageSrc:
        '/images/wix-migrated/747d6f_3cc1afd6652c406a8a85ad97d73c8c81.jpg',
      imageAlt: 'Szkliwienie prac',
      ctaLabel: 'Dodaj do koszyka',
    },
    {
      id: 'glina-box',
      badge: 'Nowość',
      title: 'GLINA BOX -KURS LEPIENIA Z GLINY PODSTAWKA WIOSENNEGO',
      priceLabel: 'Regularna cena',
      price: '229,00 zł',
      saleLabel: 'Cena rabatowa',
      salePrice: '137,00 zł',
      href: '/product-page/glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego',
      imageSrc:
        '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg',
      imageAlt: 'PHOTO-2026-03-16-11-51-54_4.jpg',
      ctaLabel: 'Dodaj do koszyka',
    },
  ],
  shipping: {
    title: 'WYSYŁKA PRACY DO SZKLIWIENIA',
    paragraphs: [
      'Wyślij do nas wyschniętą, wypaloną pracę — starannie ją zapakuj i nadaj przesyłkę lub przywieź ją osobiście do naszej pracowni.',
      'My zajmiemy się szkliwieniem i wypałem w kolorach, które wybierzesz z próbników. Prosimy o przesłanie maila z informacją, jakie kolory szkliwa wybierasz.',
      'Gotową pracę odeślemy do Ciebie w ciągu 2 tygodni 🤍',
    ],
    bullets: [] as string[],
    imageSrc:
      '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg',
    imageAlt: 'Wysyłka do szkliwienia',
    ctaLabel: 'wysyłam pracę do poszkliwienia!',
    ctaHref: '/sklep',
  },
};

export const urodzinyPage = {
  title: 'Urodziny | Pracownia Ceramiki N',
  metaDescription:
    'Urodziny pełne kreatywności i zabawy w Pracowni Ceramiki Nero.',
  hero: {
    title: 'Urodziny',
    imageSrc:
      '/images/wix-migrated/747d6f_5aaae6b332304ef5ba65344c8eb11ce0.jpg',
    imageAlt:
      'urodziny z ceramiką, kreatywne urodzinki z gliną, świetna zabawa, dla dzieci, Poznań i okolice, Suchy Las, 7 urodziny',
    logoSrc: '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png',
    intro: [
      'pełne kreatywności i zabawy',
      'Zorganizuj niezapomniane urodziny w Pracowni Ceramiki Nero i podaruj swojemu dziecku oraz jego przyjaciołom wyjątkowy dzień pełen kreatywności i radości! Czekamy na Was z otwartymi ramionami i mnóstwem inspiracji.',
      'Czy szukasz wyjątkowego pomysłu na urodziny swojego dziecka?',
      'Chcesz, aby ten dzień był niezapomniany i pełen radości?',
      'Pracownia Ceramiki Nero zaprasza na specjalne warsztaty urodzinowe, które połączą twórczą zabawę z niezapomnianymi wspomnieniami!',
      'Napisz na nerogosia@gmail.com i poproś o ofertę.',
    ],
  },
  offerIntro: {
    heading: 'Co oferujemy?',
    paragraphs: [
      'Warsztaty Ceramiczne od 5 do 15 dzieci pod okiem naszych doświadczonych instruktorów.',
      'Tworzenie: dzieci będą miały okazję tworzyć własne dzieła z gliny. Nauczą się podstawowych technik ceramiki, a każde dziecko stworzy unikalny przedmiot, który będzie mogło zabrać do domu po wypaleniu i szkliwieniu.',
      'Dekorowanie: po uformowaniu swoich dzieł, dzieci będą mogły je udekorować różnymi technikami, co pozwoli im wyrazić swoją kreatywność i stworzyć coś naprawdę wyjątkowego.',
      'Poczęstunek: w trakcie urodzin podajemy przekąski i napoje dla małych artystów przygotowane przez rodziców.',
    ],
  },
  blocks: [
    {
      id: 'dzieci',
      title: 'Urodziny z ceramiką dla dzieci',
      bullets: [
        'Każde dziecko ulepi swoje unikatowe przedmioty z gliny z moją pomocą',
        'Warsztaty mogą być tematyczne, z ulubionym bohaterem dzieci.',
        'Oferujemy szeroki wybór napojów',
        'Nasze miejsce jest pełne uroku',
        'Tort i zdjęcia na ściance ozdobionej w wybranym klimacie',
        'Ulepione przedmioty zostają wypalone w profesjonalnym piecu ceramicznym',
        'Możemy je poszkliwić lub dzieci mogą spotkać się ponownie na szkliwienie',
        'Zadzwoń i dowiedz się szczegółów, tel. 600-158-318 Małgosia',
      ],
      imageSrc:
        '/images/wix-migrated/747d6f_e0f7a1b2accc4542a5fec56b5ba4b975.jpg',
      imageAlt: '439195153_7659636140724940_2885825421017431008_n.jpg',
      imageFirst: true,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/kopia-panienski-plus-opis',
      tinted: true,
    },
    {
      id: 'kubek',
      title: 'Urodziny ozdabianie kubka',
      bullets: [
        'Rodzic z dzieckiem wybiera kubek do szkliwienia',
        'Każde dziecko szkliwi swój kubek',
        'Na kubku mogą być napisy, rysunki w jednym z parudziesięciu kolorów, które posiadamy',
        'Kubki są zdatne do picia i do mycia w zmywarce',
        'Produkty muszą być wypalone w piecu ceramicznym i są do odbioru po około 2-3 tygodniach',
        'Zadzwoń i dowiedz się szczegółów, tel. 600-158-318 Małgosia',
      ],
      imageSrc:
        '/images/wix-migrated/747d6f_efb20b5c2255491d9cd3bfa29c398561.jpg',
      imageAlt: '462563743_28177457148520016_1905632657844038078_n.jpg',
      imageFirst: false,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/kontakt',
      tinted: false,
    },
    {
      id: 'dorosli',
      title: 'Urodziny dla dorosłych',
      bullets: [
        'Stworzysz unikalne talerze, kubki, zestawy do sushi, doniczki i inne ceramiczne dzieła',
        'Degustacja wina',
        'Włoskie przystawki',
        'Włoska muzyka',
        'Profesjonalne prowadzenie',
        'Zapewnione wszystkie materiały',
        'Pomożemy wam stworzyć piękne ozdoby dla was i na prezenty dla najbliższych',
        'Zadzwoń i dowiedz się szczegółów, tel. 600-158-318 Małgosia',
      ],
      imageSrc:
        '/images/wix-migrated/747d6f_27032db4ff7642f185f09f10408c5e0f.jpg',
      imageAlt: '2a.jpg',
      imageFirst: true,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/glinadowina',
      tinted: true,
    },
    {
      id: 'malowanie',
      title: 'Urodziny z malowaniem',
      bullets: [
        'Namalujesz swój własny obraz na płótnie w dowolnym stylu — od kwiatów i pejzaży po abstrakcję lub motyw, który kochasz 🎨',
        'Twórcza zabawa w wyjątkowej atmosferze — dużo kolorów, śmiechu i pozytywnej energii',
        'Relaksująca muzyka i klimat, który pomaga wejść w flow i tworzyć bez presji',
        'Profesjonalne prowadzenie krok po kroku — nawet jeśli to Twój pierwszy obraz, pomożemy Ci stworzyć coś wyjątkowego',
        'Zapewniamy wszystkie materiały: kartki, farby, pędzle, fartuszki i niezbędne akcesoria',
        'Każdy uczestnik zabiera swój obraz do domu — jako piękną pamiątkę urodzin',
        'Zadzwoń i dowiedz się szczegółów: 600-158-318 (Małgosia) lub napisz do nas — stworzymy urodziny idealne dla Ciebie ✨',
      ],
      imageSrc:
        '/images/wix-migrated/747d6f_cd2460d4d3c1409b91c31dba9f7db804.png',
      imageAlt: 'URODZINY Z MALOWANIEM',
      imageFirst: false,
      ctaLabel: 'Napisz do nas',
      ctaHref: '/kopia-urodziny-ceramika',
      tinted: false,
    },
  ] satisfies SplitBlock[],
};

export const panienskiePage = {
  title: 'Panieńskie | Pracownia Ceramiki N',
  metaDescription:
    'Wieczory panieńskie w Pracowni Ceramiki NERO w Suchym Lesie — pakiety Glina do wina.',
  hero: {
    title: 'Wieczory panieńskie',
    imageSrc:
      '/images/wix-migrated/747d6f_f7dbb82b083943689efa367416eb192a.jpg',
    imageAlt: 'wieczor paniesnki poznan',
    logoSrc: '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png',
    intro: [
      'Szukasz pomysłu na wyjątkowy wieczór panieński pod Poznaniem?',
      'Pracownia Ceramiki NERO w Suchym Lesie zaprasza na kreatywne warsztaty „Glina do Wina” – idealne połączenie zabawy, wina i tworzenia własnych dzieł z gliny.',
      'To oryginalna atrakcja na wieczór panieński w Suchym Lesie, która gwarantuje świetną atmosferę, śmiech i niezapomniane wspomnienia z przyjaciółkami.',
      'Zorganizuj swój kreatywny wieczór panieński i wybierz pakiet dopasowany do Waszych potrzeb!',
      'Zorganizuj idealny wieczór panieński - wybierz swój PAKIET!',
    ],
  },
  blocks: [
    {
      id: 'standard',
      title: 'Panieński PAKIET STANDARD — Glina do wina',
      bullets: [
        'Każdy ulepi swoje przedmioty z gliny z moją pomocą',
        'Zapewniam włoskie przystawki',
        'Lampka wina',
        'Włoska muzyka',
        'Cudowny, klimatyczny lokal',
      ],
      imageSrc:
        '/images/wix-migrated/747d6f_dfe2828f7bac463c873af8b1df79fe47.jpg',
      imageAlt: '3a.jpg',
      imageFirst: true,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/webinar-registration',
      tinted: true,
    },
    {
      id: 'plus',
      title: 'Panieński PAKIET PLUS — Glina do wina',
      subtitle: 'kręcenie na kole',
      bullets: [
        'Każdy ulepi swoje przedmioty',
        'Zapewniam włoskie przystawki',
        'Lampka wina',
        'Włoska muzyka',
        'Cudowny, klimatyczny lokal',
        'Kręcenie na kole garncarskim jak Demi Moore w "Uwierz w ducha"',
      ],
      imageSrc:
        '/images/wix-migrated/11062b_f5420b566fbe45bf931871861e8cbf46.jpeg',
      imageAlt: 'Pottery and Clay',
      imageFirst: false,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/webinar-registration-1',
      tinted: false,
    },
    {
      id: 'vip',
      title: 'Panieński PAKIET VIP — Glina do wina',
      subtitle: 'koło garncarskie · sesja fotograficzna',
      bullets: [
        'Każdy ulepi swoje przedmioty',
        'Zapewniam lampkę wina i włoskie przystawki',
        'Kręcenie na kole garncarskim jak Demi Moore w "Uwierz w ducha"',
        'Sesja fotograficzna zrobiona przez profesjonalną fotografkę dla wszystkich dziewczyn, pakiet zdjęć do wyboru',
      ],
      imageSrc:
        '/images/wix-migrated/11062b_6526e8ba379f4d0e9347f54a2dc67b70.jpg',
      imageAlt: 'Happy Women',
      imageFirst: true,
      ctaLabel: 'Więcej szczegółów...',
      ctaHref: '/copy-of-panienski-opis',
      tinted: true,
    },
  ] satisfies SplitBlock[],
};
