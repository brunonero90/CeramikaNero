# Original → New site clone gap analysis

Generated: 2026-07-24T10:53:55.622Z

This analysis is based on the reference capture and route mapping. It does not modify the Next.js app.

## Global findings

- Original /warsztaty returns HTTP 404; the new-site /warsztaty listing is synthetic, not a 1:1 clone.
- Marketing pages must be rebuilt from content.md + page-spec.json + screenshots.
- Restore contextual image placement via image-placement.json; do not treat /galeria as equivalent.
- Booking calendars and Wix widgets are interaction-dependent.

## /

- Original URL: https://www.ceramikanero.com/
- New route: /
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /blog

- Original URL: https://www.ceramikanero.com/blog
- New route: /blog
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /blog/categories/aktualności

- Original URL: https://www.ceramikanero.com/blog/categories/aktualno%C5%9Bci
- New route: /blog
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /blog/categories/ciekawostki

- Original URL: https://www.ceramikanero.com/blog/categories/ciekawostki
- New route: /blog
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /blog/categories/o-mnie

- Original URL: https://www.ceramikanero.com/blog/categories/o-mnie
- New route: /blog
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /booking-calendar/ceramika-dla-dorosłych-pon-czw

- Original URL: https://www.ceramikanero.com/booking-calendar/ceramika-dla-doros%C5%82ych-pon-czw
- New route: /warsztaty/ceramika-dla-dorosłych-pon-czw/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/glina-do-wina-piątek-19-00-suchy-las

- Original URL: https://www.ceramikanero.com/booking-calendar/glina-do-wina-pi%C4%85tek-19-00-suchy-las
- New route: /warsztaty/glina-do-wina-piątek-19-00-suchy-las/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/glina-do-wina-w-poznaniu-w-ptasim-radiu

- Original URL: https://www.ceramikanero.com/booking-calendar/glina-do-wina-w-poznaniu-w-ptasim-radiu
- New route: /warsztaty/glina-do-wina-w-poznaniu-w-ptasim-radiu/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/glina-i-rodzina-soboty-15-00

- Original URL: https://www.ceramikanero.com/booking-calendar/glina-i-rodzina-soboty-15-00
- New route: /warsztaty/glina-i-rodzina-soboty-15-00/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/letnia-akademia-rysunku-malarstwa

- Original URL: https://www.ceramikanero.com/booking-calendar/letnia-akademia-rysunku-malarstwa
- New route: /warsztaty/letnia-akademia-rysunku-malarstwa/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/poranki-z-ceramiką-dla-dorosłych

- Original URL: https://www.ceramikanero.com/booking-calendar/poranki-z-ceramik%C4%85-dla-doros%C5%82ych
- New route: /warsztaty/poranki-z-ceramiką-dla-dorosłych/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/wrzesieńceramika-dla-dorosłych-pon

- Original URL: https://www.ceramikanero.com/booking-calendar/wrzesie%C5%84ceramika-dla-doros%C5%82ych-pon
- New route: /warsztaty/wrzesieńceramika-dla-dorosłych-pon/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /booking-calendar/wrzesieńglina-do-wina-piątek-suchy-las

- Original URL: https://www.ceramikanero.com/booking-calendar/wrzesie%C5%84glina-do-wina-pi%C4%85tek-suchy-las
- New route: /warsztaty/wrzesieńglina-do-wina-piątek-suchy-las/rezerwacja
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /cart

- Original URL: https://www.ceramikanero.com/cart
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /copy-of-panieński-opis

- Original URL: https://www.ceramikanero.com/copy-of-panie%C5%84ski-opis
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /courses

- Original URL: https://www.ceramikanero.com/courses
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: true
- Required work:

## /courses/glina-do-wina-

- Original URL: https://www.ceramikanero.com/courses/glina-do-wina-
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /courses/glina-i-rodzina-

- Original URL: https://www.ceramikanero.com/courses/glina-i-rodzina-
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /courses/imprezy-zamknięte-do-10-os.-

- Original URL: https://www.ceramikanero.com/courses/imprezy-zamkni%C4%99te-do-10-os.-
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /courses/kręcenie-na-kole-

- Original URL: https://www.ceramikanero.com/courses/kr%C4%99cenie-na-kole-
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /courses/pracowania-otwarta-

- Original URL: https://www.ceramikanero.com/courses/pracowania-otwarta-
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /dladoroslych

- Original URL: https://www.ceramikanero.com/dladoroslych
- New route: /dla-doroslych
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /dladzieci

- Original URL: https://www.ceramikanero.com/dladzieci
- New route: /dla-dzieci
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /dlafirm

- Original URL: https://www.ceramikanero.com/dlafirm
- New route: /grupy-i-firmy
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /dostawy-i-zwroty

- Original URL: https://www.ceramikanero.com/dostawy-i-zwroty
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /faq

- Original URL: https://www.ceramikanero.com/faq
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /galeria

- Original URL: https://www.ceramikanero.com/galeria
- New route: /galeria
- Capture status: captured
- Consolidated-into-galeria risk: true
- Required work:
  - New /galeria may consolidate images from many original contextual pages

## /gift-card

- Original URL: https://www.ceramikanero.com/gift-card
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: true
- Required work:
  - No mapped new-site route

## /glinadowina

- Original URL: https://www.ceramikanero.com/glinadowina
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /home

- Original URL: https://www.ceramikanero.com/home
- New route: /
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /kontakt

- Original URL: https://www.ceramikanero.com/kontakt
- New route: /kontakt
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /kopia-panieński-plus-opis

- Original URL: https://www.ceramikanero.com/kopia-panie%C5%84ski-plus-opis
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /kopia-urodziny-ceramika

- Original URL: https://www.ceramikanero.com/kopia-urodziny-ceramika
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /onas

- Original URL: https://www.ceramikanero.com/onas
- New route: /pracownia
- Capture status: captured
- Consolidated-into-galeria risk: true
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /panienskie

- Original URL: https://www.ceramikanero.com/panienskie
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /post/bycie-w-procesie-podczas-warsztatów-z-ceramiki

- Original URL: https://www.ceramikanero.com/post/bycie-w-procesie-podczas-warsztat%C3%B3w-z-ceramiki
- New route: /blog/bycie-w-procesie-podczas-warsztatów-z-ceramiki
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/czy-wiecie-że-prowadzimy-również-warsztaty-rysunku-malarstwa-i-ceramiki

- Original URL: https://www.ceramikanero.com/post/czy-wiecie-%C5%BCe-prowadzimy-r%C3%B3wnie%C5%BC-warsztaty-rysunku-malarstwa-i-ceramiki
- New route: /blog/czy-wiecie-że-prowadzimy-również-warsztaty-rysunku-malarstwa-i-ceramiki
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/czym-zajmuje-się-pracownia-ceramiki-nero

- Original URL: https://www.ceramikanero.com/post/czym-zajmuje-si%C4%99-pracownia-ceramiki-nero
- New route: /blog/czym-zajmuje-się-pracownia-ceramiki-nero
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/dlaczego-warto-wybrać-naszą-pracownię-ceramiki-dla-twoich-kreatywnych-potrzeb

- Original URL: https://www.ceramikanero.com/post/dlaczego-warto-wybra%C4%87-nasz%C4%85-pracowni%C4%99-ceramiki-dla-twoich-kreatywnych-potrzeb
- New route: /blog/dlaczego-warto-wybrać-naszą-pracownię-ceramiki-dla-twoich-kreatywnych-potrzeb
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/dziękujemy-wszystkim-którzy-są-z-nami

- Original URL: https://www.ceramikanero.com/post/dzi%C4%99kujemy-wszystkim-kt%C3%B3rzy-s%C4%85-z-nami
- New route: /blog/dziękujemy-wszystkim-którzy-są-z-nami
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/glina-do-wina

- Original URL: https://www.ceramikanero.com/post/glina-do-wina
- New route: /blog/glina-do-wina
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/jak-zacząć-przygodę-z-ceramiką

- Original URL: https://www.ceramikanero.com/post/jak-zacz%C4%85%C4%87-przygod%C4%99-z-ceramik%C4%85
- New route: /blog/jak-zacząć-przygodę-z-ceramiką
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/letnia-akademia-artystyczna-całe-wakacje

- Original URL: https://www.ceramikanero.com/post/letnia-akademia-artystyczna-ca%C5%82e-wakacje
- New route: /blog/letnia-akademia-artystyczna-całe-wakacje
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/nowe-warsztaty-ceramika-dla-smyka

- Original URL: https://www.ceramikanero.com/post/nowe-warsztaty-ceramika-dla-smyka
- New route: /blog/nowe-warsztaty-ceramika-dla-smyka
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/nowe-warsztaty-ceramika-dla-smyka-od-stycznia-2025

- Original URL: https://www.ceramikanero.com/post/nowe-warsztaty-ceramika-dla-smyka-od-stycznia-2025
- New route: /blog/nowe-warsztaty-ceramika-dla-smyka-od-stycznia-2025
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/o-mnie

- Original URL: https://www.ceramikanero.com/post/o-mnie
- New route: /blog/o-mnie
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/o-sklepie-z-ceramiką

- Original URL: https://www.ceramikanero.com/post/o-sklepie-z-ceramik%C4%85
- New route: /blog/o-sklepie-z-ceramiką
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/pikniki-artystyczne-na-polanie-przed-pracownią-ceramiki-nero

- Original URL: https://www.ceramikanero.com/post/pikniki-artystyczne-na-polanie-przed-pracowni%C4%85-ceramiki-nero
- New route: /blog/pikniki-artystyczne-na-polanie-przed-pracownią-ceramiki-nero
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/slow-design-co-oznacza

- Original URL: https://www.ceramikanero.com/post/slow-design-co-oznacza
- New route: /blog/slow-design-co-oznacza
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/startujemy-z-zapisamy-na-wrzesień-bogata-oferta-warsztatów-dla-dzieci-rysunek-malarstwo-ceramika

- Original URL: https://www.ceramikanero.com/post/startujemy-z-zapisamy-na-wrzesie%C5%84-bogata-oferta-warsztat%C3%B3w-dla-dzieci-rysunek-malarstwo-ceramika
- New route: /blog/startujemy-z-zapisamy-na-wrzesień-bogata-oferta-warsztatów-dla-dzieci-rysunek-malarstwo-ceramika
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/twój-tytuł-jak-nazwałbyś-swój-przepis

- Original URL: https://www.ceramikanero.com/post/tw%C3%B3j-tytu%C5%82-jak-nazwa%C5%82by%C5%9B-sw%C3%B3j-przepis
- New route: /blog/twój-tytuł-jak-nazwałbyś-swój-przepis
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/warsztatyzgliny

- Original URL: https://www.ceramikanero.com/post/warsztatyzgliny
- New route: /blog/warsztatyzgliny
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/wpływ-pracy-z-gliną-na-człowieka

- Original URL: https://www.ceramikanero.com/post/wp%C5%82yw-pracy-z-glin%C4%85-na-cz%C5%82owieka
- New route: /blog/wpływ-pracy-z-gliną-na-człowieka
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/wspaniała-historia-pracowni-od-miłości-do-gotowania-do-tworzenia-inspirującej-wspólnoty

- Original URL: https://www.ceramikanero.com/post/wspania%C5%82a-historia-pracowni-od-mi%C5%82o%C5%9Bci-do-gotowania-do-tworzenia-inspiruj%C4%85cej-wsp%C3%B3lnoty
- New route: /blog/wspaniała-historia-pracowni-od-miłości-do-gotowania-do-tworzenia-inspirującej-wspólnoty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /post/zaczynamy-nowe-warsztaty-już-we-wrześniu

- Original URL: https://www.ceramikanero.com/post/zaczynamy-nowe-warsztaty-ju%C5%BC-we-wrze%C5%9Bniu
- New route: /blog/zaczynamy-nowe-warsztaty-już-we-wrześniu
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Confirm Polish body text, hero image, and category placement match original post

## /product-page/glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego

- Original URL: https://www.ceramikanero.com/product-page/glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /product-page/szkliwienie-prac-w-pracowni-ceramika-nero-1

- Original URL: https://www.ceramikanero.com/product-page/szkliwienie-prac-w-pracowni-ceramika-nero-1
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /profile/gosianowicka/events

- Original URL: https://www.ceramikanero.com/profile/gosianowicka/events
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /profile/gosianowicka/forum-comments

- Original URL: https://www.ceramikanero.com/profile/gosianowicka/forum-comments
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /profile/gosianowicka/forum-posts

- Original URL: https://www.ceramikanero.com/profile/gosianowicka/forum-posts
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /profile/gosianowicka/profile

- Original URL: https://www.ceramikanero.com/profile/gosianowicka/profile
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /regulamin

- Original URL: https://www.ceramikanero.com/regulamin
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /service-page/ceramika-dla-dorosłych-pon-czw

- Original URL: https://www.ceramikanero.com/service-page/ceramika-dla-doros%C5%82ych-pon-czw
- New route: /warsztaty/ceramika-dla-dorosłych-pon-czw
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/glina-do-wina-piątek-19-00-suchy-las

- Original URL: https://www.ceramikanero.com/service-page/glina-do-wina-pi%C4%85tek-19-00-suchy-las
- New route: /warsztaty/glina-do-wina-piątek-19-00-suchy-las
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/glina-do-wina-w-poznaniu-w-ptasim-radiu

- Original URL: https://www.ceramikanero.com/service-page/glina-do-wina-w-poznaniu-w-ptasim-radiu
- New route: /warsztaty/glina-do-wina-w-poznaniu-w-ptasim-radiu
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/glina-i-rodzina-soboty-15-00

- Original URL: https://www.ceramikanero.com/service-page/glina-i-rodzina-soboty-15-00
- New route: /warsztaty/glina-i-rodzina-soboty-15-00
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/iv-turnus-półkolonie-artystyczne

- Original URL: https://www.ceramikanero.com/service-page/iv-turnus-p%C3%B3%C5%82kolonie-artystyczne
- New route: /warsztaty/iv-turnus-półkolonie-artystyczne
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/letnia-akademia-rysunku-malarstwa

- Original URL: https://www.ceramikanero.com/service-page/letnia-akademia-rysunku-malarstwa
- New route: /warsztaty/letnia-akademia-rysunku-malarstwa
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/piknik-rodzinny-z-ceramiką-12-września

- Original URL: https://www.ceramikanero.com/service-page/piknik-rodzinny-z-ceramik%C4%85-12-wrze%C5%9Bnia
- New route: /warsztaty/piknik-rodzinny-z-ceramiką-12-września
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/piknik-rodzinny-z-ceramiką-29-sierpnia

- Original URL: https://www.ceramikanero.com/service-page/piknik-rodzinny-z-ceramik%C4%85-29-sierpnia
- New route: /warsztaty/piknik-rodzinny-z-ceramiką-29-sierpnia
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/poranki-z-ceramiką-dla-dorosłych

- Original URL: https://www.ceramikanero.com/service-page/poranki-z-ceramik%C4%85-dla-doros%C5%82ych
- New route: /warsztaty/poranki-z-ceramiką-dla-dorosłych
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/wrzesieńceramika-dla-dorosłych-pon

- Original URL: https://www.ceramikanero.com/service-page/wrzesie%C5%84ceramika-dla-doros%C5%82ych-pon
- New route: /warsztaty/wrzesieńceramika-dla-dorosłych-pon
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /service-page/wrzesieńglina-do-wina-piątek-suchy-las

- Original URL: https://www.ceramikanero.com/service-page/wrzesie%C5%84glina-do-wina-pi%C4%85tek-suchy-las
- New route: /warsztaty/wrzesieńglina-do-wina-piątek-suchy-las
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime

## /services

- Original URL: https://www.ceramikanero.com/services
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:

## /services/glina-do-wina

- Original URL: https://www.ceramikanero.com/services/glina-do-wina
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /sklep

- Original URL: https://www.ceramikanero.com/sklep
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /szczeg-y-wydarzenia-i-rejestracja/piknik-rodzinny-warsztaty-wstep-wolny

- Original URL: https://www.ceramikanero.com/szczeg-y-wydarzenia-i-rejestracja/piknik-rodzinny-warsztaty-wstep-wolny
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /terms-conditions

- Original URL: https://www.ceramikanero.com/terms-conditions
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /urodziny

- Original URL: https://www.ceramikanero.com/urodziny
- New route: /warsztaty
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots

## /vouchery

- Original URL: https://www.ceramikanero.com/vouchery
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: true
- Required work:
  - No mapped new-site route

## /webinar-registration

- Original URL: https://www.ceramikanero.com/webinar-registration
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /webinar-registration-1

- Original URL: https://www.ceramikanero.com/webinar-registration-1
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /webinar-registration-2

- Original URL: https://www.ceramikanero.com/webinar-registration-2
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /webinar-registration-3

- Original URL: https://www.ceramikanero.com/webinar-registration-3
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route

## /webinar-registration-4

- Original URL: https://www.ceramikanero.com/webinar-registration-4
- New route: (none)
- Capture status: captured
- Consolidated-into-galeria risk: false
- Required work:
  - No mapped new-site route
