/**
 * Professionally structured legal copy from archived wording.
 * Presentation intentionally improves on defective Wix archive formatting
 * while preserving exact Polish legal text (no rewriting of clauses).
 */

export type LegalBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export const regulaminDocument = {
  title: 'Regulamin warsztatów | Ceramika Nero',
  metaDescription:
    'Regulamin udziału w warsztatach Pracowni ceramiki Nero w Suchym Lesie.',
  blocks: [
    { type: 'h1', text: 'Regulamin warsztatów' },
    {
      type: 'p',
      text: 'Złożenie zamówienia i opłacenie udziału jest jednoznaczne z akceptacją regulaminu warsztatów:',
    },
    { type: 'h2', text: 'Informacje ogólne' },
    {
      type: 'p',
      text: 'Organizatorem warsztatów jest Pracownia ceramiki Nero NIP 9721134965',
    },
    {
      type: 'p',
      text: 'Uczestnikiem warsztatów może zostać każda osoba fizyczna, która dokonana zgłoszenia i opłaci udział w warsztatach, a co za tym idzie zaakceptuje warunki Regulaminu.',
    },
    {
      type: 'p',
      text: 'Uczestnicy zobowiązani się do przestrzegania zasad BHP oraz bezpośrednich zaleceń oraz uwag osoby prowadzącej warsztaty. Dodatkowo wszyscy warsztatowicze zobowiązani są do zachowania czystości w miejscu prowadzenia warsztatów.',
    },
    {
      type: 'p',
      text: 'Organizator nie ponosi odpowiedzialności za ewentualne szkody powstałe na skutek nieprzestrzegania regulaminu i zaleceń instruktora.',
    },
    { type: 'h2', text: 'Zapisy na warsztaty' },
    {
      type: 'p',
      text: 'Zgłoszenia można dokonać poprzez zakup warsztatu przez sklep internetowy dostępny na www.ceramikanero.com w zakładce WARSZTATY',
    },
    {
      type: 'p',
      text: 'Gwarancją rezerwacji miejsca jest opłacenie udziału poprzez płatność dokonaną na konto.',
    },
    { type: 'h2', text: 'Płatność' },
    {
      type: 'p',
      text: 'Płatności można dokonać przelewem lub BLIKIEM na konto: 30 1140 2004 0000 3102 8314 9467.',
    },
    { type: 'h2', text: 'Nieobecność uczestnika' },
    {
      type: 'p',
      text: 'Najpóźniej 24 godziny przed rozpoczęciem warsztatów należy poinformować organizatora o nieobecności telefonicznie pod numerem telefonu 532 279 101 aby bezkosztowo ustalić nowy termin spotkania. Uczestnik ma 2 miesiące od terminu, na którym się nie pojawił, aby umówić się na kolejny termin.',
    },
    {
      type: 'p',
      text: 'Jeśli uczestnik odwołuje udział na krócej niż 24 godziny przed spotkaniem lub nie stawi się na zajęciach bez uprzedniej informacji na ten temat wpłata za warsztaty nie podlega zwrotowi.',
    },
    { type: 'h2', text: 'Odwołanie warsztatów' },
    {
      type: 'p',
      text: 'W wyjątkowych sytuacjach losowych uniemożliwiających przeprowadzenie warsztatów (choroba organizatora, awaria techniczna, inne temu podobne) organizator ma prawo do przełożenia lub odwołania warsztatów. Uczestnicy otrzymają propozycję nowego terminu lub zwrot całej kwoty wpłaconej wcześniej przez uczestników.',
    },
    { type: 'h2', text: 'Udostępnianie wizerunku' },
    {
      type: 'p',
      text: 'W trakcie trwania warsztatów mogą zostać wykonane zdjęcia, dokumentujące efekty prac oraz przebieg zajęć. Fotografie mogą zostać opublikowane na stronie internetowej pracowni. Na niektórych ujęciach mogą pojawić się również Uczestnicy warsztatów. Organizator ma obowiązek upewnić się przed wykonaniem zdjęć czy uczestnicy potwierdzają zgodę na użyczenie wizerunku.',
    },
    {
      type: 'p',
      text: 'Jeżeli Uczestnik nie wyraża zgody na udostępnianie wizerunku, ma obowiązek poinformowania o tym organizatora przed wykonaniem zdjęć.',
    },
    { type: 'h2', text: 'Reklamacje' },
    {
      type: 'p',
      text: 'Uczestnik może złożyć reklamację z powodu niewykonania lub nienależytego wykonania Umowy przez organizatora.',
    },
    {
      type: 'p',
      text: 'Reklamację należy złożyć mailowo na adres: kontakt@ceramikanero.pl lub telefonicznie 532279101',
    },
    {
      type: 'p',
      text: 'Reklamacja powinna zawierać: dane uczestnika, nazwę Wydarzenia, którego reklamacja dotyczy, określenie przedmiotu reklamacji, przedstawienie okoliczności uzasadniających reklamację.',
    },
    {
      type: 'p',
      text: 'Reklamacja może być złożona w terminie miesiąca od ostatniego dnia zaistnienia zdarzenia stanowiącego przedmiot reklamacji. Reklamację złożoną po upływie tego terminu pozostawia się bez rozpoznania, o czym organizator niezwłocznie powiadomi uczestnika.',
    },
    {
      type: 'p',
      text: 'Organizator potwierdza przyjęcie reklamacji drogą elektroniczną, przesyłając potwierdzenie mailowe. Reklamacja zostanie rozpatrzona w terminie do 14 dni od dnia jej przyjęcia. O sposobie załatwienia reklamacji organizator zawiadamia uczestnika drogą mailową, przesyłając informację zwrotną wraz z uzasadnieniem.',
    },
    {
      type: 'p',
      text: 'Złożenie reklamacji nie zwalnia z obowiązku uiszczenia opłaty za warsztaty.',
    },
  ] satisfies LegalBlock[],
};

/** Privacy policy from archived /terms-conditions — wording preserved, layout fixed. */
export const politykaPrywatnosciDocument = {
  title: 'Polityka prywatności | Ceramika Nero',
  metaDescription:
    'Polityka prywatności i bezpieczeństwo danych w Pracowni ceramiki Nero.',
  blocks: [
    { type: 'h1', text: 'Prywatność i bezpieczeństwo' },
    { type: 'h2', text: 'Polityka prywatności' },
    { type: 'p', text: 'Drogi Użytkowniku!' },
    {
      type: 'p',
      text: 'Dbamy o Twoją prywatność i chcemy, abyś w czasie korzystania z naszych usług czuł się komfortowo. Dlatego też poniżej prezentujemy Ci najważniejsze informacje o zasadach przetwarzania przez nas Twoich danych osobowych oraz plikach cookies, które są wykorzystywane przez nasz Sklep. Informacje te zostały przygotowane z uwzględnieniem RODO, czyli ogólnego rozporządzenia o ochronie danych.',
    },
    { type: 'h2', text: 'Administrator danych osobowych' },
    {
      type: 'p',
      text: 'Małgorzata Nero, przedsiębiorca prowadzący działalność gospodarczą pod firmą Pracownia ceramiki Nero Małgorzata Nero, wpisany do Centralnej Ewidencji i Informacji o Działalności Gospodarczej prowadzonej przez ministra właściwego do spraw gospodarki i prowadzenia Centralnej Ewidencji i Informacji o Działalności Gospodarczej, NIP 9721134965 ul. Podgórna 3 62-002 Suchy Las',
    },
    {
      type: 'p',
      text: 'Jeśli chcesz skontaktować się z nami w związku z przetwarzaniem przez nas Twoich danych osobowych, napisz do nas na adres e-mail: kontakt@ceramikanero.pl',
    },
    { type: 'h2', text: 'Twoje uprawnienia' },
    {
      type: 'p',
      text: 'Przysługuje Ci prawo żądania:',
    },
    {
      type: 'ul',
      items: [
        'dostępu do Twoich danych osobowych, w tym uzyskania kopii Twoich danych (art. 15 RODO lub — jeśli ma to zastosowanie — art. 13 ust. 1 lit. f RODO),',
        'ich sprostowania (art. 16 RODO),',
        'usunięcia (art. 17 RODO),',
        'ograniczenia przetwarzania (art. 18 RODO),',
        'przeniesienia danych do innego administratora (art. 20 RODO).',
      ],
    },
    {
      type: 'p',
      text: 'A także prawo wniesienia w dowolnym momencie sprzeciwu wobec przetwarzania Twoich danych: z przyczyn związanych z Twoją szczególną sytuacją — wobec przetwarzania dotyczących Ciebie danych osobowych, opartego na art. 6 ust. 1 lit. f RODO (tj. na realizowanych przez nas prawnie uzasadnionych interesach), w tym profilowania (art. 21 ust. 1 RODO); jeżeli dane osobowe są przetwarzane na potrzeby marketingu bezpośredniego, w tym profilowania, w zakresie, w jakim przetwarzanie jest związane z takim marketingiem bezpośrednim (art. 21 ust. 2 RODO).',
    },
    {
      type: 'p',
      text: 'Skontaktuj się z nami, jeśli chcesz skorzystać ze swoich praw. Sprzeciw w odniesieniu do wykorzystywania przez nas plików cookies możesz wyrazić zwłaszcza za pomocą odpowiednich ustawień przeglądarki.',
    },
    {
      type: 'p',
      text: 'Jeśli uznasz, że Twoje dane są przetwarzane niezgodnie z prawem, możesz złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.',
    },
    { type: 'h2', text: 'Dane osobowe i prywatność' },
    {
      type: 'p',
      text: 'Poniżej znajdziesz szczegółowe informacje na temat przetwarzania Twoich danych w zależności od podejmowanych przez Ciebie działań.',
    },
    { type: 'h3', text: '1. Złożenie zamówienia w Sklepie — cz. 1' },
    {
      type: 'p',
      text: 'W jakim celu? realizacja Twojego zamówienia.',
    },
    {
      type: 'p',
      text: 'Na jakiej podstawie? umowa sprzedaży (art. 6 ust. 1 lit. b RODO); obowiązek prawny, związany z rachunkowością, zobowiązujący nas do przetwarzania Twoich danych osobowych (art. 6 ust. 1 lit. c RODO).',
    },
    {
      type: 'p',
      text: 'Jak długo? przez okres obowiązywania wyżej wymienionej umowy do momentu wygaśnięcia ciążącego na nas obowiązku prawnego, związanego z rachunkowością; ponadto, Twoje dane będą przetwarzane do upływu okresu, w którym możliwe jest dochodzenie roszczeń — przez Ciebie lub przez nas.',
    },
    {
      type: 'p',
      text: 'Co się stanie, jeśli nie podasz danych? nie będziesz mieć możliwości złożenia zamówienia.',
    },
    { type: 'h3', text: '2. Złożenie zamówienia w Sklepie — cz. 2' },
    {
      type: 'p',
      text: 'W jakim celu? dostosowanie Sklepu do potrzeb Użytkowników, a także polepszenie jakości świadczonych przez nas usług, dzięki opiniom wystawianym przez Kupujących za pośrednictwem serwisu do badania satysfakcji.',
    },
    {
      type: 'p',
      text: 'Na jakiej podstawie? nasz prawnie uzasadniony interes, polegający na przetwarzaniu Twoich danych w celu prowadzenia badań Twojej satysfakcji z naszych usług (art. 6 ust. 1 lit. f RODO).',
    },
    {
      type: 'p',
      text: 'Kontakt w sprawach danych osobowych: kontakt@ceramikanero.pl, tel. 532 279 101. Regulamin udziału w warsztatach: /regulamin.',
    },
  ] satisfies LegalBlock[],
  note: 'Intentional departure from archived /terms-conditions presentation: the Wix page merged workshop rules with a long privacy policy and had broken line wrapping, escaped punctuation, and run-on headings. Wording of clauses is preserved; hierarchy, lists, and paragraph breaks are restored for readability. Remaining long-form archive tables remain in reference/original-site for full CMS migration.',
};
