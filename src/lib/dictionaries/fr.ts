import type { Dictionary } from "./en";

/**
 * French — a partial override of the English dictionary. Keys omitted here
 * fall back to English (see src/lib/dictionaries/index.ts), and keys that do
 * not exist in `en` are a compile error.
 */
export const fr: Partial<Dictionary> = {
  // --- Header / navigation -------------------------------------------------
  "nav.home": "Accueil",
  "nav.hotels": "Hôtels",
  "nav.rooms": "Chambres & Suites",
  "nav.offers": "Offres",
  "nav.flights": "Vols",
  "nav.hotel": "L'hôtel",
  "nav.contact": "Contact",

  "a11y.openMenu": "Ouvrir le menu",
  "a11y.closeMenu": "Fermer le menu",
  "a11y.homeLink": "Accueil Santo Hotel",
  "a11y.language": "Langue",
  "a11y.displayCurrency": "Devise d'affichage",

  "header.staffConsole": "Console du personnel",
  "header.myBookings": "Mes réservations",
  "header.logIn": "Connexion",
  "header.signUp": "S'inscrire",
  "header.book": "Réservez votre séjour",

  // --- Footer --------------------------------------------------------------
  "footer.tagline": "Un séjour réfléchi.\nUne bienvenue sincère.",
  "footer.explore": "Découvrir Santo",
  "footer.rooms": "Chambres & Suites",
  "footer.offers": "Offres spéciales",
  "footer.flightTracker": "Suivi des vols",
  "footer.ourHotel": "Notre hôtel",
  "footer.gallery": "Galerie & Équipements",
  "footer.yourStay": "Votre séjour",
  "footer.myBookings": "Mes réservations",
  "footer.assistance": "Assistance à la réservation",
  "footer.cancellation": "Politique d'annulation",
  "footer.faq": "Questions fréquentes",
  "footer.signOut": "Se déconnecter",
  "footer.connect": "Restons en contact",
  "footer.contactTeam": "Contactez notre équipe",
  "footer.note":
    "Des séjours attentionnés, des détails soignés. Chaque réservation est prise en charge par notre équipe.",
  "footer.copyright": "© 2026 {hotelName}. Tous droits réservés.",
  "footer.privacy": "Politique de confidentialité",
  "footer.terms": "Conditions générales",
  "footer.billedIn": "Prix en {display} · facturé en {currency}",

  // --- Policy dialog -------------------------------------------------------
  "policy.cancellation": "Politique d'annulation",
  "policy.privacy": "Politique de confidentialité",
  "policy.terms": "Conditions générales",
  "policy.body":
    "Notre {policy} approuvée par l'hôtel est disponible à la réception. Contactez l'hôtel si vous en avez besoin avant de réserver.",

  // --- Shared page furniture (breadcrumb, headings) ------------------------
  "breadcrumb.home": "Accueil",

  // --- Room card -----------------------------------------------------------
  "room.suiteCollection": "La collection de suites",
  "room.guestFavourite": "Un favori des voyageurs",
  "room.categorySuite": "LA COLLECTION DE SUITES",
  "room.categoryRetreat": "VOTRE REFUGE PERSONNEL",
  "room.descriptionFallback": "Un espace soigneusement pensé pour vous détendre et vous sentir chez vous.",
  "room.guests": "{count} voyageurs",
  "room.ensuite": "Salle de bain privée",
  "room.availableCount": "{count} disponibles",
  "room.from": "À partir de",
  "room.perNight": "/ nuit",
  "room.stayTotal": "{total} pour {nights} {unit} · avant taxes et frais",
  "room.night": "nuit",
  "room.nights": "nuits",
  "room.selected": "Sélectionné ✓",
  "room.select": "Choisir cette chambre",
  "room.viewDetails": "Voir les détails",
  "room.viewRoom": "Voir la chambre",
  "room.book": "Réserver une chambre",

  // --- Gallery lightbox ----------------------------------------------------
  "gallery.title": "Un aperçu de Santo",
  "gallery.count": "Photographies de l'hôtel · {current} sur {total}",
  "gallery.alt": "Galerie du Santo Hotel",
  "gallery.previous": "Précédent",
  "gallery.next": "Suivant",
  "gallery.viewAll": "Voir toutes les photos",

  // --- Home page -----------------------------------------------------------
  "home.hero.alt": "Hall accueillant du Santo Hotel, matériaux naturels et vue sur le jardin",
  "home.hero.eyebrow": "BIENVENUE CHEZ {hotel}",
  "home.hero.tagline": "Un séjour réfléchi. Une bienvenue sincère.",
  "home.hero.explore": "Trouvez votre confort",
  "home.reassurance.yourWay": "Votre séjour, à votre façon",
  "home.reassurance.clearPrices": "Des prix clairs, aucune surprise",
  "home.reassurance.welcome": "Un accueil chaleureux vous attend",
  "home.reassurance.live": "Disponibilités en direct · Réservation sécurisée",

  "home.rooms.eyebrow": "CHAMBRES & SUITES",
  "home.rooms.title": "Un espace qui vous appartient.",
  "home.rooms.explore": "Explorer toutes les chambres",
  "home.rooms.intro":
    "Détendez-vous dans des espaces soigneusement conçus, où chaque détail est juste.",

  "home.inventory.eyebrow": "LA LISTE DES CHAMBRES",
  "home.inventory.title": "Les {count} chambres, prêtes à réserver.",
  "home.inventory.browse": "Parcourir chambres & suites",
  "home.inventory.intro":
    "Toutes les chambres de la maison, une par une — choisissez exactement celle où vous voulez dormir.",
  "home.inventory.room": "Chambre {number}",
  "home.inventory.floor": "Étage {floor}",

  "home.why.eyebrow": "L'ESSENCE DE SANTO",
  "home.why.title": "Ce sont les petits détails qui font un séjour.",
  "home.why.intro": "Des espaces réfléchis. Des moments comptés. Une hospitalité qui vous ressemble.",

  "home.offers.eyebrow": "UN PEU PLUS ENCORE",
  "home.offers.title": "Profitez pleinement de votre séjour.",
  "home.offers.discover": "Découvrir nos offres",
  "home.offers.explore": "Voir l'offre",

  "home.gallery.eyebrow": "UN APERÇU DE SANTO",
  "home.gallery.title": "Imaginez-vous ici.",
  "home.gallery.view": "Voir la galerie",
  "home.gallery.space1": "Des espaces accueillants",
  "home.gallery.space2": "Des instants calmes au bord de la piscine",
  "home.gallery.space3": "Une chambre paisible",

  "home.review.eyebrow": "L'EXPÉRIENCE CLIENT",
  "home.review.titleLine1": "Des souvenirs pour",
  "home.review.titleLine2": "y revenir.",
  "home.review.quote":
    "\u201cUn bel endroit pour ralentir. Chaque détail était attentionné, et tout le séjour fut d'une simplicité délicieuse.\u201d",
  "home.review.stayType": "Séjour de loisirs",
  "home.review.rating": "Note des voyageurs",

  "home.location.eyebrow": "VOTRE PROCHAIN CHAPITRE COMMENCE ICI",
  "home.location.titleLine1": "Un lieu où arriver.",
  "home.location.titleLine2": "Une raison de rester.",
  "home.location.intro": "Trouvez le chemin d'un séjour plus attentionné.",
  "home.location.cta": "Nous contacter",
  "home.location.mapNote": "Position cartographique confirmée à la réservation",

  // Home: offer previews ---------------------------------------------------
  "home.offer.slow.eyebrow": "PRENEZ LE TEMPS POUR VOUS",
  "home.offer.slow.name": "Le week-end sans hâte",
  "home.offer.slow.desc":
    "Remplacez votre rythme habituel par des matins tranquilles et une évasion méritée.",
  "home.offer.longer.eyebrow": "PLUS DE TEMPS, PLUS DE SOUVENIRS",
  "home.offer.longer.name": "Restez un peu plus longtemps",
  "home.offer.longer.desc": "Installez-vous, explorez à votre rythme et faites comme chez vous.",
  "home.offer.together.eyebrow": "DES MOMENTS À PARTAGER",
  "home.offer.together.name": "Ensemble à Santo",
  "home.offer.together.desc":
    "Un cadre attentionné pour une occasion spéciale ou simplement du temps ensemble.",

  // Home: highlight tiles ---------------------------------------------------
  "home.highlight.design.title": "Conçu avec soin",
  "home.highlight.design.copy": "Des espaces qui allient beaux détails et confort quotidien.",
  "home.highlight.welcome.title": "Une vraie bienvenue",
  "home.highlight.welcome.copy": "Une attention sincère pour vous faire sentir chez vous.",
  "home.highlight.slow.title": "Le temps de ralentir",
  "home.highlight.slow.copy": "Des matins sans hâte et le simple plaisir d'être ici.",
  "home.highlight.comfort.title": "Un confort réfléchi",
  "home.highlight.comfort.copy": "Les petits détails qui changent tout.",

  // --- Search panel --------------------------------------------------------
  "search.checkIn": "ARRIVÉE",
  "search.checkOut": "DÉPART",
  "search.adults": "ADULTES",
  "search.children": "ENFANTS",
  "search.roomsLabel": "CHAMBRES",
  "search.errorDates": "Le départ doit être postérieur à l'arrivée.",
  "search.adult": "adulte",
  "search.adultsPlural": "adultes",
  "search.child": "enfant",
  "search.childrenPlural": "enfants",
  "search.room": "chambre",
  "search.roomsPlural": "chambres",
  "search.submit": "Voir les disponibilités",
  "search.aria.checkIn": "Date d'arrivée",
  "search.aria.checkOut": "Date de départ",
  "search.aria.adults": "Adultes",
  "search.aria.children": "Enfants",
  "search.aria.rooms": "Nombre de chambres",

  // --- Rooms listing -------------------------------------------------------
  "listing.breadcrumb.availability": "Disponibilités",
  "listing.eyebrow.availability": "VOTRE SÉJOUR SANTO",
  "listing.eyebrow.catalog": "CHAMBRES & SUITES",
  "listing.title.availability": "Votre séjour commence ici.",
  "listing.title.catalog": "Trouvez le séjour parfait.",
  "listing.description":
    "Des chambres soigneusement conçues. Tout l'espace nécessaire pour vous sentir chez vous.",
  "listing.chooseView": "Choisir l'affichage des chambres",
  "listing.viewList": "Liste",
  "listing.viewMap": "Carte",
  "listing.statusMap": "Vue carte. La liste des chambres et les filtres restent disponibles.",
  "listing.statusList": "Vue liste.",
  "listing.refine": "Affiner votre séjour",
  "listing.reset": "Réinitialiser",
  "listing.roomType": "Type de chambre",
  "listing.filterAll": "Toutes les chambres",
  "listing.filterRooms": "Chambres",
  "listing.filterSuites": "Suites",
  "listing.budget": "Budget par nuit",
  "listing.maxPrice": "Prix nocturne maximum",
  "listing.upTo": "Jusqu'à {amount}",
  "listing.guestsLegend": "Voyageurs",
  "listing.minCapacity": "Capacité minimale de la chambre",
  "listing.any": "Tous",
  "listing.extras": "Les petits plus",
  "listing.ratesNote":
    "Les tarifs et disponibilités sont confirmés par l'hôtel lorsque votre réservation est traitée.",
  "listing.showRooms": "Afficher les chambres",
  "listing.needDetail": "Il nous faut un peu plus de détails",
  "listing.resultsOne": "{count} chambre à faire vôtre",
  "listing.resultsMany": "{count} chambres à faire vôtre",
  "listing.dateRange": "{checkIn} → {checkOut} · {nights} {unit}",
  "listing.catalogueNote": "Catalogue en direct · Tarifs par nuit",
  "listing.filters": "Filtres",
  "listing.sortBy": "Trier par",
  "listing.sortRecommended": "Recommandé",
  "listing.sortLow": "Prix : de moins en plus",
  "listing.sortHigh": "Prix : de plus en moins",
  "listing.pauseTitle": "Une courte pause.",
  "listing.tryAgain": "Réessayer",
  "listing.noFitTitle": "Trouvons une autre option.",
  "listing.noFitBody":
    "Aucune chambre ne correspond à ces dates ou filtres. Élargissez votre recherche.",
  "listing.clearFilters": "Effacer les filtres",
  "listing.confirmNote":
    "Tous les prix sont confirmés par notre équipe de réservation. Les taxes et frais s'affichent au paiement.",
  "listing.mapAria": "Carte de localisation de l'hôtel",

  // --- Room detail ---------------------------------------------------------
  "detail.openMap": "Ouvrir la carte",
  "detail.badge": "Hébergement Santo",
  "detail.chooseThisRoom": "Choisir cette chambre",
  "detail.checkDates": "Voir les dates",
  "detail.photoAlt": "Photo {index} de {name}",
  "detail.viewPhoto": "Voir la photo {index} de la chambre",
  "detail.spaceTitle": "Un espace où s'installer.",
  "detail.spaceBody1":
    "Matériaux naturels, textures douces et disposition soigneusement pensée. La {name} associe un coin reposant à des espaces attentionnés pour les instants d'entre-deux.",
  "detail.spaceBody2":
    "Du café tranquille du matin à la dernière page d'un bon livre, laissez la place à un séjour à votre rythme.",
  "detail.comforts": "Conforts attentionnés",
  "detail.chooseRoom": "Choisissez votre chambre",
  "detail.searchFailed": "Impossible de vérifier ce séjour — veuillez réessayer.",
  "detail.noneFree":
    "Aucune chambre {name} n'est libre pour ces dates. Essayez d'autres dates ou explorez un autre type de chambre.",
  "detail.continueBooking": "Continuer la réservation",
  "detail.faq.checkInTitle": "Arrivée & départ",
  "detail.faq.checkInBody": "Arrivée à partir de {inTime}, départ avant {outTime}.",
  "detail.faq.cancellationTitle": "Annulation & paiement",
  "detail.faq.cancellationBody":
    "Annulation gratuite jusqu'à {hours} heures avant l'arrivée. Le paiement s'effectue via la page sécurisée de l'hôtel.",
  "detail.faq.accessibilityTitle": "Accessibilité",
  "detail.faq.accessibilityBody":
    "Les informations d'accessibilité propres à la chambre sont disponibles auprès de notre équipe. Contactez l'hôtel avant d'organiser vos déplacements.",
  "detail.faq.houseRulesTitle": "Règles de la maison",
  "detail.faq.houseRulesBody":
    "Les politiques tabac, animaux, visiteurs et heures de calme sont confirmées par l'hôtel à l'arrivée.",
  "summary.selectDates": "Choisissez vos dates",
  "summary.guestsLine": "{adults} adultes · {children} enfants · {quantity} {unit}",
  "summary.room": "chambre",
  "summary.rooms": "chambres",
  "summary.yourDates": "Vos dates, à votre façon",
  "summary.priceNote": "Prix pour une chambre. Taxes et frais confirmés au paiement.",
  "summary.selectDatesNote":
    "Choisissez vos dates pour voir les disponibilités en direct et le total du séjour.",
  "summary.nightRow": "{rate} × {nights} {unit}",
  "summary.taxesRow": "Taxes ({percent}%)",
  "summary.serviceFeeRow": "Frais de service",
  "summary.availableCount": "{count} {unit} disponible",
  "summary.noneAvailable": "Aucune chambre disponible pour ces dates",
  "detail.mapTitle": "Où vous séjournerez",

  // --- Search map ----------------------------------------------------------
  "map.demoNotice": "Position cartographique de démonstration · pas l'adresse vérifiée de l'hôtel",
  "map.canvasAria": "Carte indiquant l'emplacement de {name}",
  "map.loading": "Chargement de la carte…",
  "map.errorTitle": "La carte n'a pas pu être chargée.",
  "map.errorBody":
    "La liste des chambres et le parcours de réservation ne sont pas affectés — chaque chambre reste accessible à côté de ce panneau.",
  "map.showPrices": "Afficher les prix {label}",
  "map.hidePrices": "Masquer les prix",
  "map.cardAria": "Prix et disponibilités de {name}",
  "map.closeCard": "Fermer les prix et disponibilités",
  "map.directions": "Itinéraire",
  "map.nightlyFrom": "Tarifs par nuit à partir de",
  "map.dateRange": "· {checkIn} → {checkOut} ({nights} {unit})",
  "map.noRooms":
    "Aucune chambre ne correspond à vos filtres ou dates. Élargissez la recherche pour voir ce qui est disponible.",
  "map.available": "{count} {unit} disponible",
  "map.perNight": "par nuit",
  "map.stayTotal": "{total} pour {nights} {unit}",
  "map.openGmaps": "Ouvrir dans Google Maps",
  "map.unavailableTitle": "Position cartographique indisponible",
  "map.unavailableBody":
    "La position vérifiée de l'hôtel sur la carte n'a pas encore été définie. La liste des chambres et le parcours de réservation ne sont pas affectés.",
  "map.from": "À partir de",

  // --- Booking summary -----------------------------------------------------
  "summary.yourSelection": "VOTRE SÉLECTION",
  "summary.totalStay": "Total du séjour",
  "summary.changeRoom": "Changer de chambre",

  // --- Checkout ------------------------------------------------------------
  "checkout.step.guest": "Coordonnées",
  "checkout.step.review": "Vérifier la réservation",
  "checkout.step.confirm": "Confirmation",
  "checkout.guestTitle": "Coordonnées du voyageur",
  "checkout.privacyNote":
    "Vos coordonnées servent uniquement à gérer cette réservation.",
  "checkout.firstName": "Prénom *",
  "checkout.lastName": "Nom *",
  "checkout.email": "Adresse e-mail *",
  "checkout.phone": "Numéro de téléphone",
  "checkout.idType": "Type de pièce d'identité",
  "checkout.idTypePlaceholder": "Passeport / carte nationale d'identité",
  "checkout.idNumber": "Numéro de la pièce",
  "checkout.requests": "Demandes particulières (facultatif)",
  "checkout.requestsPlaceholder":
    "Un petit détail qui rendrait votre séjour plus agréable",
  "checkout.requestsNote": "Les demandes sont transmises à l'équipe de l'hôtel.",
  "checkout.secureTitle": "Réservation sécurisée",
  "checkout.secureBody":
    "Annulation gratuite jusqu'à {hours} heures avant l'arrivée. Le paiement s'effectue après l'examen de votre réservation.",
  "checkout.reviewStay": "Vérifier votre séjour",
  "checkout.reviewTitle": "Vérifiez vos coordonnées",
  "checkout.guestName": "Nom du voyageur",
  "checkout.stayRow": "Séjour",
  "checkout.identification": "Identité",
  "checkout.editGuest": "Modifier les coordonnées",
  "checkout.paymentTitle": "Paiement après confirmation",
  "checkout.paymentBody":
    "Votre réservation est créée d'abord. Vous pourrez ensuite payer en toute sécurité depuis la page de confirmation.",
  "checkout.acceptTerms":
    "Je confirme que ces informations sont exactes et j'accepte les conditions d'annulation de l'hôtel.",
  "checkout.back": "Retour",
  "checkout.reserving": "Réservation en cours…",
  "checkout.complete": "Finaliser la réservation",

  // Checkout error codes ---------------------------------------------------
  "checkout.error.price_changed":
    "Le prix a changé pendant votre réservation. Les totaux ci-dessus sont à jour — veuillez vérifier et confirmer à nouveau.",
  "checkout.error.unavailable":
    "Ces chambres ne sont plus disponibles pour vos dates. Veuillez relancer la recherche.",
  "checkout.error.account_required":
    "Un compte est nécessaire pour réserver en ligne — veuillez d'abord vous connecter.",
  "checkout.error.check_in_past":
    "Ce séjour commencerait dans le passé — veuillez choisir de nouvelles dates.",
  "checkout.error.promotion_not_found": "Ce code promotionnel n'existe pas.",
  "checkout.error.promotion_inactive": "Cette promotion n'est pas actuellement active.",
  "checkout.error.promotion_expired": "Cette promotion n'est plus valable.",
  "checkout.error.promotion_exhausted": "Cette promotion a été entièrement utilisée.",
  "checkout.error.too_many_rooms":
    "C'est plus de chambres qu'une seule réservation ne peut contenir.",
  "checkout.error.invalid_body": "Veuillez vérifier les champs du formulaire et réessayer.",
  "checkout.error.internal":
    "Une erreur est survenue lors de la création de la réservation. Veuillez réessayer.",
  "checkout.error.fallback": "La réservation n'a pas pu être finalisée.",

  // --- Cancellation button -------------------------------------------------
  "cancel.confirm": "Annuler cette réservation ?",
  "cancel.busy": "Annulation en cours…",
  "cancel.action": "Annuler la réservation",
  "cancel.error.too_late_to_cancel": "Le délai d'annulation gratuite est déjà passé.",
  "cancel.error.not_cancellable": "Cette réservation ne peut plus être annulée.",
  "cancel.error.guest_cancellation_disabled":
    "L'annulation en ligne est désactivée — veuillez contacter l'hôtel.",
  "cancel.error.not_found": "Cette réservation est introuvable.",
  "cancel.error.internal": "Une erreur est survenue. Veuillez réessayer.",

  // --- Confirmation / payment ---------------------------------------------
  "confirmation.print": "Imprimer la confirmation",
  "pay.processing": "Traitement en cours…",
  "pay.now": "Payer maintenant",
  "pay.simulateDecline": "Simuler une carte refusée",
  "pay.error.declined": "Le paiement n'a pas pu être effectué. Veuillez réessayer.",
  "pay.error.recorded": "Le refus simulé a été enregistré.",
  "pay.error.internal": "Une erreur est survenue. Veuillez réessayer.",

  // --- Hotel info / contact ------------------------------------------------
  "hotel.hero.alt": "Le hall accueillant de Santo",
  "hotel.hero.eyebrow": "DÉCOUVREZ SANTO",
  "hotel.hero.title1": "Réfléchi par nature.",
  "hotel.hero.title2": "Accueillant par cœur.",
  "hotel.hero.body": "Un lieu pour les moments qui comptent.",
  "hotel.breadcrumb.contact": "Contact",
  "hotel.breadcrumb.hotel": "L'hôtel",
  "hotel.addressFallback": "Adresse de l'hôtel à confirmer",
  "hotel.intro.eyebrow": "L'ESSENCE DE SANTO",
  "hotel.intro.title1": "Un peu moins ordinaire.",
  "hotel.intro.title2": "Un peu plus vous.",
  "hotel.intro.body":
    "Chez Santo, l'idée est simple : de beaux espaces, un confort réfléchi et un accueil sincère. Un lieu pour ralentir, vous connecter et trouver votre propre rythme.",
  "hotel.galleryLabel": "Ouvrir la photo {index} de la propriété",
  "hotel.amenities.eyebrow": "DE QUOI PROFITER",
  "hotel.amenities.title": "Un confort réfléchi, du début à la fin.",
  "hotel.amenities.note": "Demandez à notre équipe les derniers détails pendant votre séjour.",
  "hotel.amenity.dining": "Restauration & rencontres",
  "hotel.amenity.leisure": "Loisirs & détente",
  "hotel.amenity.outdoor": "Espaces extérieurs",
  "hotel.amenity.services": "Services aux voyageurs",
  "hotel.faq.eyebrow": "À SAVOIR",
  "hotel.faq.title": "Quelques détails utiles.",
  "hotel.faq.q.checkIn": "À quelle heure puis-je arriver et partir ?",
  "hotel.faq.a.checkIn": "L'arrivée se fait à partir de {inTime} et le départ avant {outTime}.",
  "hotel.faq.q.cancellation": "Quelle est la politique d'annulation ?",
  "hotel.faq.a.cancellation":
    "L'annulation gratuite est possible jusqu'à {hours} heures avant l'arrivée. Passé ce délai, les conditions de l'hôtel s'appliquent.",
  "hotel.faq.q.accessible": "Des chambres accessibles sont-elles disponibles ?",
  "hotel.faq.a.accessible":
    "L'accessibilité des chambres et les installations sans marche varient selon le type de chambre. Contactez l'hôtel avant de planifier votre visite.",
  "hotel.faq.q.houseRules": "Quelles sont les règles de la maison ?",
  "hotel.faq.a.houseRules":
    "Les politiques tabac, animaux, visiteurs et heures de calme sont confirmées par l'hôtel à l'arrivée.",
  "hotel.faq.q.requests": "Puis-je faire une demande particulière ?",
  "hotel.faq.a.requests":
    "Oui — ajoutez votre demande pendant le paiement ou contactez directement l'hôtel. Les demandes restent soumises aux disponibilités.",
  "hotel.bottomTitle": "Trouvez votre moment Santo.",
  "hotel.exploreRooms": "Découvrez nos chambres",

  // --- Contact -------------------------------------------------------------
  "contact.eyebrow": "NOUS AIMERIONS VOUS LIRE",
  "contact.title": "Tout séjour commence par bonjour.",
  "contact.description":
    "Une question, une occasion spéciale ou un petit coup de main pour organiser votre séjour.",
  "contact.connectEyebrow": "RESTONS EN CONTACT",
  "contact.connectTitle1": "Un accueil chaleureux",
  "contact.connectTitle2": "n'est que le début.",
  "contact.connectBody":
    "Pour une aide à la réservation ou une question sur votre séjour, notre équipe est là pour vous aider.",
  "contact.findUs": "Nous trouver",
  "contact.writeUs": "Écrivez-nous",
  "contact.callUs": "Appelez-nous",
  "contact.emailFallback": "Adresse e-mail à confirmer",
  "contact.phoneFallback": "Numéro de téléphone à confirmer",
  "contact.mapNote": "Itinéraire exact confirmé à la réservation",
  "contact.formTitle": "Un petit mot pour notre équipe",
  "contact.formNote":
    "Ce formulaire ouvre votre application e-mail afin que votre message parvienne directement à l'hôtel.",
  "contact.name": "Votre nom *",
  "contact.email": "Adresse e-mail *",
  "contact.subjectLabel": "Votre sujet ?",
  "contact.messageLabel": "Votre message *",
  "contact.messagePlaceholder": "Comment rendre votre séjour encore plus attentionné ?",
  "contact.send": "Envoyer le message",
  "contact.subjectDefault": "Demande générale",
  "contact.subjectBooking": "Assistance à la réservation",
  "contact.subjectAccessibility": "Accessibilité",
  "contact.subjectOccasion": "Occasion spéciale",
  "contact.mailtoBody": "Nom : {name}\nE-mail : {email}\n\n{message}",
  "contact.noEmail":
    "Notre adresse e-mail est en cours de confirmation. Veuillez appeler l'hôtel pour l'instant.",
  "contact.openedApp": "Votre application e-mail devrait s'ouvrir avec votre message prêt à envoyer.",

  // --- Offers page ---------------------------------------------------------
  "offers.hero.alt": "Une paisible piscine intérieure",
  "offers.hero.eyebrow": "UN PEU PLUS ENCORE",
  "offers.hero.title1": "Encore plus de raisons",
  "offers.hero.title2": "de choisir Santo.",
  "offers.hero.body": "Des idées attentionnées pour un séjour qui vous ressemble.",
  "offers.eyebrow": "SÉJOURS SÉLECTIONNÉS",
  "offers.title": "Votre temps. Précieusement vécu.",
  "offers.note":
    "Interrogez notre équipe de réservation sur les dates, l'éligibilité et les inclus.",
  "offers.dialogTitle": "Un séjour auquel se réjouir",
  "offers.dialogBody":
    "Cette offre réunit une belle chambre et le temps d'en profiter. Contactez notre équipe pour confirmer les détails selon vos dates.",
  "offers.applicableDates": "Dates applicables",
  "offers.eligibility": "Éligibilité",
  "offers.termsInclusions": "Conditions & inclus",
  "offers.contactHotel": "Contacter l'hôtel",
  "offers.confirmedAtBooking": "Confirmé à la réservation",
  "offers.exploreAccommodation": "Découvrez l'hébergement",

  // --- Page metadata (browser tab titles) ---------------------------------
  "meta.rooms.title": "Chambres & Suites",
  "meta.rooms.description":
    "Trouvez le séjour parfait dans la collection de chambres et suites du Santo Hotel. Découvrez l'hébergement, les équipements et les tarifs.",
  "meta.search.title": "Trouvez votre séjour",
  "meta.search.description":
    "Explorez les disponibilités en direct pour votre séjour sélectionné au Santo Hotel.",
  "meta.offers.title": "Un peu plus encore",
  "meta.offers.description":
    "Découvrez les forfaits de séjour du Santo Hotel et des idées attentionnées pour votre prochaine escapade.",
  "meta.hotel.title": "L'essence de Santo",
  "meta.hotel.description":
    "Découvrez le concept du Santo Hotel, ses espaces, les informations voyageurs et les questions fréquentes.",
  "meta.contact.title": "Dites bonjour",
  "meta.contact.description":
    "Contactez le Santo Hotel pour une aide à la réservation, une question d'accessibilité ou une occasion spéciale.",

  // --- Shared policy note --------------------------------------------------
  "policy.freeCancellation": "Annulation gratuite jusqu'à {hours} heures avant l'arrivée",
  "policy.freeCancellationCheckIn":
    "Annulation gratuite jusqu'à {hours} heures avant l'arrivée.",

  // --- Booking page --------------------------------------------------------
  "booking.backToRooms": "Retour aux chambres",
  "booking.eyebrow": "QUELQUES DÉTAILS ATTENTIONNÉS",
  "booking.title": "Votre séjour prend forme.",
  "booking.description":
    "Vérifiez votre sélection et complétez vos coordonnées. Votre réservation est confirmée avant le paiement.",
  "booking.failureTitle": "Nous n'avons pas pu retenir ces chambres.",
  "booking.failureFallback": "Ces chambres ne peuvent pas être réservées pour les dates choisies.",
  "booking.searchOther": "Chercher d'autres chambres",
  "booking.lineRow": "{type} · Chambre {number}",
  "booking.discount": "Remise",
  "booking.discountCode": "Remise ({code})",
  "booking.taxes": "Taxes",
  "booking.serviceFee": "Frais de service",
  "booking.moreRooms": "{type} + {count} de plus",
  "booking.guestsLine": "{adults} {adultUnit} · {children} {childUnit} · {rooms} {roomUnit}",

  // Quote error codes -------------------------------------------------------
  "quote.error.room_not_found": "L'une des chambres sélectionnées n'existe plus.",
  "quote.error.invalid_date_range": "Le départ doit être postérieur à l'arrivée.",
  "quote.error.stay_too_long": "Ce séjour dépasse la limite de 60 nuits.",

  // --- Weather -------------------------------------------------------------
  "weather.title": "Météo",
  "weather.eyebrow": "MÉTÉO LOCALE",
  "weather.loading": "Chargement de la météo...",
  "weather.unavailable": "La météo est indisponible pour le moment.",
  "weather.retry": "Réessayer",
  "weather.today": "Aujourd'hui",
  "weather.updated": "Mis à jour à {time}",
  "weather.stale": "Dernière mise à jour disponible",
  "weather.attribution": "Météo par Open-Meteo",
  "weather.aria": "Météo actuelle à {city} : {temperature} degrés, {condition}",
  "weather.feelsLike": "Ressenti",
  "weather.humidity": "Humidité",
  "weather.wind": "Vent",
  "weather.precipitation": "Pluie",
  "weather.forecast": "Prévisions sur 4 jours",
  "weather.windUnit": "km/h",
  "weather.rainUnit": "mm",
  "weather.clear": "Ciel dégagé",
  "weather.mainlyClear": "Plutôt dégagé",
  "weather.partlyCloudy": "Partiellement nuageux",
  "weather.overcast": "Couvert",
  "weather.fog": "Brouillard",
  "weather.drizzle": "Bruine",
  "weather.freezingDrizzle": "Bruine verglaçante",
  "weather.rain": "Pluie",
  "weather.freezingRain": "Pluie verglaçante",
  "weather.snow": "Neige",
  "weather.snowGrains": "Grains de neige",
  "weather.showers": "Averses",
  "weather.snowShowers": "Averses de neige",
  "weather.thunderstorm": "Orage",
  "weather.thunderstormHail": "Orage avec grêle",
  "weather.unknown": "Météo",

  // --- Flight tracking (OpenSky) -------------------------------------------
  "meta.flights.title": "Suivi des vols",
  "meta.flights.description":
    "Suivez les aéronefs en direct autour de Santo Hotel, recherchez par numéro de vol ou indicatif et consultez l'altitude, la vitesse et le cap.",
  "flights.breadcrumb": "Suivi des vols",
  "flights.eyebrow": "CIEL EN DIRECT",
  "flights.title": "Suivez les vols en temps réel.",
  "flights.description":
    "Recherchez n'importe quel vol dans le monde ou explorez les aéronefs en direct près de {hotel}, avec l'altitude, la vitesse et le cap.",
  "flights.worldwide": "Aéronefs en direct dans le monde",
  "flights.scope.label": "Zone de la carte",
  "flights.scope.world": "Monde",
  "flights.scope.hotel": "Près de l'hôtel",
  "flights.search.label": "Numéro de vol ou indicatif",
  "flights.search.placeholder": "ex. BAW117 ou BA117",
  "flights.search.hint":
    "Recherchez dans le flux mondial en direct par indicatif OACI ou numéro de vol. Exemples : BAW117, KLM1023, N123AB.",
  "flights.search.globalHint":
    "Recherche dans le flux mondial en direct. Effacez la recherche pour revenir aux aéronefs près de l'hôtel.",
  "flights.search.button": "Suivre le vol",
  "flights.search.clear": "Effacer la recherche",
  "flights.regional": "Aéronefs près de {hotel}",
  "flights.searchResults": "Résultats pour {query}",
  "flights.count": "{count} aéronefs",
  "flights.countOne": "1 aéronef",
  "flights.live": "En direct",
  "flights.cached": "En cache",
  "flights.loading": "Chargement des vols en direct...",
  "flights.refreshing": "Mise à jour...",
  "flights.errorShort": "Indisponible",
  "flights.updated": "Mis à jour à {time}",
  "flights.refresh": "Actualiser",
  "flights.autoRefresh": "Actualisation auto",
  "flights.map.loading": "Chargement de la carte en direct...",
  "flights.map.errorTitle": "Carte indisponible",
  "flights.map.errorBody":
    "La carte en direct n'a pas pu être chargée. La liste des vols reste disponible.",
  "flights.map.unavailableTitle": "Carte non configurée",
  "flights.map.unavailableBody":
    "Ajoutez une clé API Google Maps pour activer la carte interactive. La liste des vols reste disponible.",
  "flights.map.aria": "Carte interactive des aéronefs en direct près de {hotel}",
  "flights.map.ariaWorld": "Carte interactive des aéronefs en direct dans le monde",
  "flights.map.noAircraft": "Aucun aéronef en direct dans cette zone pour le moment.",
  "flights.legend": "Aéronefs en direct",
  "flights.list.empty": "Aucun aéronef en direct trouvé près de {hotel}.",
  "flights.list.emptyWorld": "Aucun aéronef en direct n'est disponible pour le moment.",
  "flights.list.emptySearch":
    "Aucun aéronef en direct ne correspond à {query}. OpenSky diffuse les indicatifs OACI ; essayez l'indicatif complet, par ex. BAW117.",
  "flights.detail.title": "Détails du vol",
  "flights.detail.close": "Fermer les détails du vol",
  "flights.detail.altitude": "Altitude",
  "flights.detail.speed": "Vitesse sol",
  "flights.detail.heading": "Cap",
  "flights.detail.verticalRate": "Taux vertical",
  "flights.detail.status": "Statut",
  "flights.detail.airborne": "En vol",
  "flights.detail.onGround": "Au sol",
  "flights.detail.lastContact": "Dernier contact",
  "flights.detail.icao24": "ICAO24",
  "flights.detail.squawk": "Squawk",
  "flights.detail.positionSource": "Source de position",
  "flights.detail.sourceAdsB": "ADS-B",
  "flights.detail.sourceAsterix": "ASTERIX",
  "flights.detail.sourceMlat": "MLAT",
  "flights.detail.sourceFlarm": "FLARM",
  "flights.detail.sourceOther": "Autre",
  "flights.unit.meters": "m",
  "flights.unit.feet": "ft",
  "flights.unit.kmh": "km/h",
  "flights.unit.knots": "kn",
  "flights.unit.fpm": "ft/min",
  "flights.attribution": "Données de vol en direct par",
  "flights.error.not_configured":
    "Le suivi des vols n'est pas encore configuré. Veuillez réessayer plus tard.",
  "flights.error.invalid_query":
    "Cette recherche n'est pas valide. Utilisez un numéro de vol ou un indicatif composé de lettres et de chiffres (2 à 10 caractères).",
  "flights.error.rate_limited":
    "Le flux de vols est très sollicité. Patientez un instant puis réessayez.",
  "flights.error.upstream":
    "Les données de vol sont temporairement indisponibles. Veuillez réessayer bientôt.",
  "flights.error.network":
    "Impossible de joindre le service de vols. Vérifiez votre connexion et réessayez.",
  "flights.error.generic":
    "Les données de vol n'ont pas pu être chargées. Veuillez réessayer.",

  // --- Login ---------------------------------------------------------------
  "login.breadcrumb": "Connexion",
  "login.eyebrow": "VOTRE COIN DE SANTO",
  "login.title": "Content de vous revoir.",
  "login.description": "Vos séjours, vos coordonnées, tout au même endroit.",
  "login.expired": "Votre session a expiré ou a été révoquée. Veuillez vous reconnecter.",
  "login.error.invalid": "Identifiants invalides",
  "login.error.rate_limited":
    "Trop de tentatives échouées — patientez quelques minutes puis réessayez.",
  "login.email": "Adresse e-mail",
  "login.password": "Mot de passe",
  "login.emailPlaceholder": "vous@exemple.com",
  "login.signIn": "Se connecter",
  "login.newToSanto": "Nouveau chez Santo ?",
  "login.createAccount": "Créer un compte voyageur",
  "login.staffTitle": "Connexion personnel & administrateur",
  "login.staffEmail": "E-mail du personnel",
  "login.staffSignIn": "Se connecter à la console",

  // --- Social sign-in (Firebase Google) -----------------------------------
  "auth.google.continue": "Continuer avec Google",
  "auth.google.signup": "S'inscrire avec Google",
  "auth.google.signingIn": "Connexion à Google...",
  "auth.google.or": "ou continuer avec l'e-mail",
  "auth.google.orSignup": "ou créer un compte avec l'e-mail",
  "auth.signingOut": "Déconnexion...",
  "auth.google.error.invalid_token":
    "Cette connexion n'est plus valide. Veuillez réessayer avec Google.",
  "auth.google.error.email_unverified":
    "Votre adresse Google n'est pas vérifiée. Vérifiez-la auprès de Google, puis réessayez.",
  "auth.google.error.provider_not_allowed":
    "Cette méthode de connexion n'est pas activée pour Santo. Veuillez utiliser Google.",
  "auth.google.error.account_disabled":
    "Ce compte a été désactivé. Veuillez contacter l'hôtel.",
  "auth.google.error.signup_disabled":
    "Les nouveaux comptes voyageurs sont indisponibles. Contactez l'hôtel pour réserver.",
  "auth.google.error.staff_account":
    "Cette adresse appartient à un compte du personnel. Utilisez le formulaire de connexion du personnel.",
  "auth.google.error.identity_conflict":
    "Cette adresse est déjà liée à une autre méthode de connexion. Veuillez contacter l'hôtel.",
  "auth.google.error.rate_limited":
    "Trop de tentatives. Patientez quelques minutes puis réessayez.",
  "auth.google.error.popup_closed": "La connexion Google a été annulée.",
  "auth.google.error.popup_blocked":
    "Votre navigateur a bloqué la fenêtre Google. Autorisez les pop-ups et réessayez.",
  "auth.google.error.unauthorized_domain":
    "La connexion Google n'est pas configurée pour ce domaine. Veuillez contacter l'hôtel.",
  "auth.google.error.network":
    "Impossible de joindre Google. Vérifiez votre connexion et réessayez.",
  "auth.google.error.generic":
    "La connexion Google n'a pas pu aboutir. Veuillez réessayer.",

  // --- Signup --------------------------------------------------------------
  "signup.breadcrumb": "Créer un compte",
  "signup.eyebrow": "VOTRE COIN DE SANTO",
  "signup.title": "Faites comme chez vous.",
  "signup.description": "Gardez vos séjours et vos coordonnées réunis.",
  "signup.error.exists": "E-mail déjà enregistré",
  "signup.error.invalid":
    "Informations invalides — vérifiez votre nom, votre e-mail et les exigences du mot de passe.",
  "signup.disabledTitle": "Les comptes voyageurs sont actuellement indisponibles.",
  "signup.disabledBody": "Contactez l'hôtel pour finaliser une réservation.",
  "signup.firstName": "Prénom",
  "signup.lastName": "Nom",
  "signup.email": "Adresse e-mail",
  "signup.password": "Mot de passe (8 caractères minimum, avec un chiffre)",
  "signup.create": "Créer le compte",
  "signup.haveAccount": "Vous avez déjà un compte ?",
  "signup.signIn": "Se connecter",

  // --- Account -------------------------------------------------------------
  "account.breadcrumb": "Mon Santo",
  "account.eyebrow": "MON SANTO",
  "account.welcome": "Content de vous revoir, {name}.",
  "account.guestName": "voyageur",
  "account.description": "Vos séjours, vos coordonnées, tout au même endroit.",
  "account.nav.overview": "Aperçu",
  "account.nav.bookings": "Mes réservations",
  "account.nav.profile": "Coordonnées",
  "account.nav.signOut": "Se déconnecter",
  "account.profileTitle": "Vos coordonnées",
  "account.profileNote": "Contactez l'hôtel pour mettre à jour vos coordonnées.",
  "account.name": "Nom",
  "account.email": "Adresse e-mail",
  "account.googleConnected": "Connecté avec Google",
  "account.contactHotel": "Contacter l'hôtel",
  "account.nextStay": "Votre prochain séjour",
  "account.liveReservations": "Réservations en direct",
  "account.noUpcoming": "Aucun séjour à venir pour l'instant.",
  "account.noUpcomingBody": "Votre prochain moment Santo attend d'être planifié.",
  "account.exploreRooms": "Découvrir les chambres",
  "account.pastStays": "Séjours passés",
  "account.noPast": "Aucun séjour passé pour l'instant.",
  "account.santoStay": "Séjour Santo",
  "account.viewReservation": "Voir la réservation",
  "account.cancelUnavailable": "L'annulation en ligne n'est plus disponible.",
  "account.total": "Total : {total}",
  "account.reference": "Référence : {ref}",

  // Booking / payment status labels (enum → readable) -----------------------
  "status.booking.PENDING": "En attente",
  "status.booking.CONFIRMED": "Confirmée",
  "status.booking.CHECKED_IN": "Arrivée effectuée",
  "status.booking.CHECKED_OUT": "Départ effectué",
  "status.booking.CANCELLED": "Annulée",
  "status.booking.NO_SHOW": "Non présenté",
  "status.payment.PENDING": "En attente",
  "status.payment.PAID": "Payé",
  "status.payment.FAILED": "Échoué",
  "status.payment.REFUNDED": "Remboursé",
  "status.payment.PARTIALLY_REFUNDED": "Partiellement remboursé",

  // --- Booking confirmation ------------------------------------------------
  "confirmation.emptyTitle": "Confirmation de réservation",
  "confirmation.emptyBody": "Aucune référence de réservation n'a été fournie.",
  "confirmation.backHome": "Retour à l'hôtel",
  "confirmation.notFoundTitle": "Nous n'avons pas trouvé cette réservation.",
  "confirmation.notFoundBody":
    "La réservation {ref} n'est pas disponible pour ce navigateur ou ce compte.",
  "confirmation.searchRooms": "Chercher des chambres",
  "confirmation.eyebrow.cancelled": "RÉSERVATION ANNULÉE",
  "confirmation.eyebrow.success": "QUELQUE CHOSE À ANTICIPER",
  "confirmation.title.cancelled": "Votre réservation a été annulée.",
  "confirmation.title.success": "Votre séjour au Santo Hotel",
  "confirmation.body.cancelled": "Nous espérons vous accueillir une autre fois.",
  "confirmation.body.success": "Une petite évasion, soigneusement composée.",
  "confirmation.referenceBadge": "Référence {ref} · {status}",
  "confirmation.detailsEyebrow": "DÉTAILS DE LA RÉSERVATION",
  "confirmation.guest": "Voyageur",
  "confirmation.stay": "Séjour",
  "confirmation.party": "Voyageurs",
  "confirmation.paymentStatus": "Statut du paiement",
  "confirmation.cancellation": "Annulation",
  "confirmation.until": "Jusqu'au {when} UTC",
  "confirmation.cancelledNotice":
    "Cette réservation a été annulée et aucune autre action n'est requise.",
  "confirmation.paidNotice":
    "Votre réservation est intégralement payée. Nous avons hâte de vous accueillir.",
  "confirmation.heldNotice":
    "Votre réservation est retenue. Finalisez le paiement pour confirmer votre séjour.",
  "confirmation.payNow": "Payer {amount} maintenant",
  "confirmation.yourRequests": "Vos demandes",
  "confirmation.viewBookings": "Voir mes réservations",
  "confirmation.returnHome": "Retour à l'accueil",
  "confirmation.freeCancellationUntil": "Annulation gratuite jusqu'au {when} UTC.",
  "confirmation.cancellationTerms":
    "Les conditions d'annulation sont confirmées par l'hôtel.",

  // --- Payment page --------------------------------------------------------
  "pay.backToConfirmation": "Retour à la confirmation",
  "pay.eyebrow": "PAIEMENT SÉCURISÉ",
  "pay.title.paid": "Cette réservation est payée.",
  "pay.title.cancelled": "Cette réservation a été annulée.",
  "pay.title.due": "Finalisez votre paiement.",
  "pay.description": "Réservation {ref} · {checkIn} → {checkOut}",
  "pay.amountDue": "MONTANT DÛ",
  "pay.secureTitle": "Paiement sécurisé",
  "pay.secureBody":
    "Finalisez le paiement pour confirmer la réservation. Vos chambres sont retenues pendant le traitement du paiement.",
  "pay.paidNotice":
    "Aucun autre paiement n'est dû. Nous avons hâte de vous accueillir.",
  "pay.cancelledNotice":
    "Cette réservation a été annulée et ne peut plus être payée en ligne.",
  "pay.note": "Le paiement s'effectue via la page sécurisée de l'hôtel.",

  // --- AI concierge chat ---------------------------------------------------
  // Widget chrome (client) ---------------------------------------------------
  "chat.greeting.signedIn":
    "Content de vous revoir — je suis le **concierge Santo**. Je peux vérifier les disponibilités en direct, suggérer des chambres, valider un code promo, afficher nos chambres les plus demandées, prendre une réservation ou vous enregistrer au départ. Comment puis-je vous aider ?",
  "chat.greeting.guest":
    "Bonjour — je suis le **concierge Santo**. Je peux vérifier les disponibilités en direct, suggérer des chambres, valider un code promo, afficher nos chambres les plus demandées, prendre une réservation, créer votre compte ou vous enregistrer au départ. Comment puis-je vous aider ?",
  "chat.quick.rooms": "Voir les chambres",
  "chat.quick.discounts": "Des remises ?",
  "chat.quick.best": "Chambres les plus demandées",
  "chat.quick.book": "Je veux réserver",
  "chat.quick.signup": "Créer mon compte",
  "chat.quick.checkout": "Départ de mon séjour",
  "chat.tool.suggest_rooms": "Recherche de chambres",
  "chat.tool.check_availability": "Vérification des disponibilités",
  "chat.tool.check_discount": "Vérification des remises",
  "chat.tool.best_selling_rooms": "Classement des préférées",
  "chat.tool.create_reservation": "Prise de la réservation",
  "chat.tool.signup_user": "Création du compte",
  "chat.tool.lookup_booking": "Recherche de la réservation",
  "chat.tool.check_out_stay": "Traitement du départ",
  "chat.title": "Concierge Santo",
  "chat.panelAria": "Chat du concierge de l'hôtel",
  "chat.status": "En ligne · répond instantanément",
  "chat.closeAria": "Fermer le chat",
  "chat.typingAria": "Le concierge écrit",
  "chat.placeholder": "Une question sur les chambres, les dates, les remises…",
  "chat.inputAria": "Écrire au concierge",
  "chat.stop": "Arrêter",
  "chat.sendAria": "Envoyer le message",
  "chat.footer": "Concierge IA · données hôtelières en direct",
  "chat.fabCloseAria": "Fermer le chat du concierge",
  "chat.fabOpenAria": "Discuter avec le concierge de l'hôtel",
  "chat.fabClose": "Fermer",
  "chat.fabOpen": "Concierge",
  "chat.error.offline":
    "Le concierge est hors ligne pour le moment — veuillez utiliser la page contact.",
  "chat.error.rateLimited":
    "Nous recevons beaucoup de questions — patientez un instant puis réessayez.",
  "chat.error.unreachable": "Impossible de joindre le concierge — veuillez réessayer.",
  "chat.error.generic": "Une erreur est survenue — veuillez réessayer.",
  "chat.error.cutOff": "La réponse a été interrompue — renvoyez votre message.",
  "chat.error.stopped": "Arrêté.",
  "chat.error.connection": "Problème de connexion — veuillez réessayer.",

  // Server stream + tool activity rows ---------------------------------------
  "chat.error.stream": "Le chat a rencontré un problème inattendu — veuillez réessayer.",
  "chat.error.model": "Le chat a rencontré un problème inattendu.",
  "chat.error.empty": "L'assistant n'a renvoyé aucune réponse.",
  "chat.detail.noMatchFilters": "Aucune chambre ne correspond à ces filtres",
  "chat.detail.typesFreeOne": "{count} type de chambre libre",
  "chat.detail.typesFreeMany": "{count} types de chambres libres",
  "chat.detail.noRoomsFreeDates": "Aucune chambre libre à ces dates",
  "chat.detail.typesOnOfferOne": "{count} type de chambre disponible",
  "chat.detail.typesOnOfferMany": "{count} types de chambres disponibles",
  "chat.detail.roomsFreeOne": "{count} chambre libre",
  "chat.detail.roomsFreeMany": "{count} chambres libres",
  "chat.detail.noRoomsFree": "Aucune chambre libre",
  "chat.detail.discountsOne": "{count} remise en cours",
  "chat.detail.discountsMany": "{count} remises en cours",
  "chat.detail.noDiscounts": "Aucune remise en cours",
  "chat.detail.codeInvalid": "Code {code} non valide",
  "chat.detail.codeValid": "Code {code} valide — {saving}",
  "chat.detail.savingPercent": "{value} % de remise",
  "chat.detail.savingFixed": "{amount} de remise",
  "chat.detail.noHistory": "Aucun historique de réservation",
  "chat.detail.top": "Top : {name}",
  "chat.detail.nothingFree": "Rien de libre à ces dates",
  "chat.detail.notEnough": "Pas assez de chambres de ce type",
  "chat.detail.reserved": "Réservé · {ref}",
  "chat.detail.alreadySignedIn": "Déjà connecté",
  "chat.detail.signUpDisabled": "Inscription désactivée",
  "chat.detail.detailsRejected": "Informations refusées",
  "chat.detail.emailTaken": "E-mail déjà enregistré",
  "chat.detail.signedUp": "Compte créé · {email}",
  "chat.detail.referenceNeeded": "Référence requise",
  "chat.detail.signInToView": "Connectez-vous pour voir cette réservation",
  "chat.detail.bookingLine": "{ref} · {status}",
  "chat.detail.notFound": "Réservation introuvable",
  "chat.detail.notYours": "Pas votre réservation",
  "chat.detail.noActiveStay": "Aucun séjour en cours",
  "chat.detail.checkedOut": "Départ enregistré · {ref}",
  "chat.detail.signInToCheckOut": "Connectez-vous pour votre départ",
  "chat.detail.somethingWrong": "Une erreur est survenue",
  "chat.detail.couldNotComplete": "Impossible de finaliser",

  // Server-side fallbacks when the admin content slots are empty ----------
  "home.addressFallback": "Adresse de l'hôtel à confirmer.",
  "home.heroTitleFallback": "Votre séjour, pensé dans les moindres détails.",
  "home.heroBodyFallback":
    "Découvrez le confort, un accueil exceptionnel et un séjour sur mesure au Santo Hotel.",
};
