/**
 * English is the source language: `Dictionary` is derived from this file, and
 * every other locale (src/lib/dictionaries/fr.ts, ar.ts) is typed as a partial
 * of it. That makes an unknown key a compile error and lets a missing
 * translation fall back to English instead of rendering blank.
 *
 * Keys are flat and namespaced by area (`nav.`, `footer.`, `rooms.`) so they
 * read unambiguously at the call site: t("nav.rooms").
 *
 * Placeholders use `{name}` and are filled by t(key, { name }) — the same
 * value is substituted in every locale, so translators only move the text.
 */
export const en = {
  // --- Header / navigation -------------------------------------------------
  "nav.home": "Home",
  "nav.rooms": "Rooms & Suites",
  "nav.offers": "Offers",
  "nav.hotel": "The Hotel",
  "nav.contact": "Contact",

  "a11y.openMenu": "Open menu",
  "a11y.closeMenu": "Close menu",
  "a11y.homeLink": "Santo Hotel home",
  "a11y.language": "Language",
  "a11y.displayCurrency": "Display currency",

  "header.staffConsole": "Staff console",
  "header.myBookings": "My Bookings",
  "header.logIn": "Log in",
  "header.signUp": "Sign up",
  "header.book": "Book your stay",

  // --- Footer --------------------------------------------------------------
  "footer.tagline": "A considered stay.\nA genuine welcome.",
  "footer.explore": "Explore Santo",
  "footer.rooms": "Rooms & Suites",
  "footer.offers": "Special Offers",
  "footer.ourHotel": "Our Hotel",
  "footer.gallery": "Gallery & Facilities",
  "footer.yourStay": "Your stay",
  "footer.myBookings": "My Bookings",
  "footer.assistance": "Booking Assistance",
  "footer.cancellation": "Cancellation Policy",
  "footer.faq": "Frequently Asked Questions",
  "footer.signOut": "Sign out",
  "footer.connect": "Let's connect",
  "footer.contactTeam": "Contact our team",
  "footer.note":
    "Thoughtful stays, considered details. Every reservation is handled by our team.",
  "footer.copyright": "© 2026 {hotelName}. All rights reserved.",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms & Conditions",
  "footer.billedIn": "{display} prices · billed in {currency}",

  // --- Policy dialog -------------------------------------------------------
  "policy.cancellation": "Cancellation policy",
  "policy.privacy": "Privacy policy",
  "policy.terms": "Terms & conditions",
  "policy.body":
    "Our hotel-approved {policy} is available from the front desk. Please contact the hotel if you need a copy before booking.",

  // --- Shared page furniture (breadcrumb, headings) ------------------------
  "breadcrumb.home": "Home",

  // --- Room card -----------------------------------------------------------
  "room.suiteCollection": "The suite collection",
  "room.guestFavourite": "A guest favourite",
  "room.categorySuite": "THE SUITE COLLECTION",
  "room.categoryRetreat": "YOUR PERSONAL RETREAT",
  "room.descriptionFallback": "A thoughtfully considered space to unwind and feel at home.",
  "room.guests": "{count} guests",
  "room.ensuite": "En-suite",
  "room.availableCount": "{count} available",
  "room.from": "From",
  "room.perNight": "/ night",
  "room.stayTotal": "{total} for {nights} {unit} · before taxes & fees",
  "room.night": "night",
  "room.nights": "nights",
  "room.selected": "Selected ✓",
  "room.select": "Select room",
  "room.viewDetails": "View details",
  "room.viewRoom": "View room",
  "room.book": "Book a room",

  // --- Gallery lightbox ----------------------------------------------------
  "gallery.title": "A closer look at Santo",
  "gallery.count": "Hotel photography · {current} of {total}",
  "gallery.alt": "Santo Hotel gallery",
  "gallery.previous": "Previous",
  "gallery.next": "Next",
  "gallery.viewAll": "View all photos",

  // --- Home page -----------------------------------------------------------
  "home.hero.alt": "A welcoming Santo Hotel lobby with natural materials and garden views",
  "home.hero.eyebrow": "A WARM WELCOME TO {hotel}",
  "home.hero.tagline": "A considered stay. A genuine welcome.",
  "home.hero.explore": "Find your kind of comfort",
  "home.reassurance.yourWay": "Your stay, your way",
  "home.reassurance.clearPrices": "Clear prices, no surprises",
  "home.reassurance.welcome": "A warm welcome awaits",
  "home.reassurance.live": "Live room availability · Secure booking",

  "home.rooms.eyebrow": "ROOMS & SUITES",
  "home.rooms.title": "A space to call your own.",
  "home.rooms.explore": "Explore all rooms",
  "home.rooms.intro": "Unwind in thoughtfully designed spaces, where every detail feels just right.",

  "home.inventory.eyebrow": "THE ROOM LIST",
  "home.inventory.title": "All {count} rooms, ready to book.",
  "home.inventory.browse": "Browse rooms & suites",
  "home.inventory.intro":
    "Every room in the house, listed one by one — pick the exact room you want to stay in.",
  "home.inventory.room": "Room {number}",
  "home.inventory.floor": "Floor {floor}",

  "home.why.eyebrow": "THE SANTO DIFFERENCE",
  "home.why.title": "It's the little things that make a stay.",
  "home.why.intro": "Considered spaces. Meaningful moments. Hospitality that feels personal.",

  "home.offers.eyebrow": "A LITTLE SOMETHING MORE",
  "home.offers.title": "Make the most of your stay.",
  "home.offers.discover": "Discover our offers",
  "home.offers.explore": "Explore offer",

  "home.gallery.eyebrow": "A GLIMPSE OF SANTO",
  "home.gallery.title": "Picture yourself here.",
  "home.gallery.view": "View gallery",
  "home.gallery.space1": "Welcoming spaces",
  "home.gallery.space2": "Quiet moments by the pool",
  "home.gallery.space3": "A peaceful room",

  "home.review.eyebrow": "THE GUEST EXPERIENCE",
  "home.review.titleLine1": "Memories worth",
  "home.review.titleLine2": "coming back for.",
  "home.review.quote":
    "\u201cA beautiful space to slow down. Every detail felt thoughtful, and the whole stay was wonderfully effortless.\u201d",
  "home.review.stayType": "Leisure stay",
  "home.review.rating": "Guest rating",

  "home.location.eyebrow": "YOUR NEXT CHAPTER STARTS HERE",
  "home.location.titleLine1": "A place to arrive.",
  "home.location.titleLine2": "A reason to linger.",
  "home.location.intro": "Find your way to a more considered stay.",
  "home.location.cta": "Get in touch",
  "home.location.mapNote": "Map location confirmed at booking",

  // Home: offer previews ---------------------------------------------------
  "home.offer.slow.eyebrow": "MAKE TIME FOR YOURSELF",
  "home.offer.slow.name": "The Slow Weekend",
  "home.offer.slow.desc":
    "Trade your everyday rhythm for unhurried mornings and a well-deserved escape.",
  "home.offer.longer.eyebrow": "MORE TIME, MORE MEMORIES",
  "home.offer.longer.name": "Stay a Little Longer",
  "home.offer.longer.desc": "Settle in, explore at your own pace, and make yourself at home.",
  "home.offer.together.eyebrow": "MOMENTS WORTH SHARING",
  "home.offer.together.name": "Together at Santo",
  "home.offer.together.desc":
    "A thoughtful setting for a special occasion or simply time together.",

  // Home: highlight tiles ---------------------------------------------------
  "home.highlight.design.title": "Thoughtfully designed",
  "home.highlight.design.copy": "Spaces that balance beautiful details with everyday comfort.",
  "home.highlight.welcome.title": "A genuine welcome",
  "home.highlight.welcome.copy": "A thoughtful approach to making you feel at home.",
  "home.highlight.slow.title": "Room to slow down",
  "home.highlight.slow.copy": "Unhurried mornings and the simple pleasure of being here.",
  "home.highlight.comfort.title": "Comfort, considered",
  "home.highlight.comfort.copy": "The little touches that make all the difference.",

  // --- Search panel --------------------------------------------------------
  "search.checkIn": "CHECK-IN",
  "search.checkOut": "CHECK-OUT",
  "search.adults": "ADULTS",
  "search.children": "CHILDREN",
  "search.roomsLabel": "ROOMS",
  "search.errorDates": "Check-out must be after check-in.",
  "search.adult": "Adult",
  "search.adultsPlural": "Adults",
  "search.child": "Child",
  "search.childrenPlural": "Children",
  "search.room": "Room",
  "search.roomsPlural": "Rooms",
  "search.submit": "Search availability",
  "search.aria.checkIn": "Check-in",
  "search.aria.checkOut": "Check-out",
  "search.aria.adults": "Adults",
  "search.aria.children": "Children",
  "search.aria.rooms": "Rooms",

  // --- Rooms listing -------------------------------------------------------
  "listing.breadcrumb.availability": "Availability",
  "listing.eyebrow.availability": "YOUR SANTO STAY",
  "listing.eyebrow.catalog": "ROOMS & SUITES",
  "listing.title.availability": "Your stay starts here.",
  "listing.title.catalog": "Find your perfect stay.",
  "listing.description":
    "Beautifully considered rooms. All the space you need to feel at home.",
  "listing.chooseView": "Choose room view",
  "listing.viewList": "List",
  "listing.viewMap": "Map",
  "listing.statusMap": "Map view. Room list and filters are still available.",
  "listing.statusList": "List view.",
  "listing.refine": "Refine your stay",
  "listing.reset": "Reset",
  "listing.roomType": "Room type",
  "listing.filterAll": "All accommodation",
  "listing.filterRooms": "Rooms",
  "listing.filterSuites": "Suites",
  "listing.budget": "Nightly budget",
  "listing.maxPrice": "Maximum nightly price",
  "listing.upTo": "Up to {amount}",
  "listing.guestsLegend": "Guests",
  "listing.minCapacity": "Minimum room capacity",
  "listing.any": "Any",
  "listing.extras": "The little extras",
  "listing.ratesNote":
    "Rates and availability are confirmed by the hotel when your reservation is processed.",
  "listing.showRooms": "Show rooms",
  "listing.needDetail": "We need a little more detail",
  "listing.resultsOne": "{count} room to make your own",
  "listing.resultsMany": "{count} rooms to make your own",
  "listing.dateRange": "{checkIn} → {checkOut} · {nights} {unit}",
  "listing.catalogueNote": "Live room catalogue · Rates per night",
  "listing.filters": "Filters",
  "listing.sortBy": "Sort by",
  "listing.sortRecommended": "Recommended",
  "listing.sortLow": "Price: low to high",
  "listing.sortHigh": "Price: high to low",
  "listing.pauseTitle": "A momentary pause.",
  "listing.tryAgain": "Try again",
  "listing.noFitTitle": "Let's find another fit.",
  "listing.noFitBody": "No rooms match these dates or filters. Try widening your search.",
  "listing.clearFilters": "Clear filters",
  "listing.confirmNote":
    "All prices are confirmed by our reservations team. Taxes and fees are shown at checkout.",
  "listing.mapAria": "Hotel location map",

  // --- Room detail ---------------------------------------------------------
  "detail.openMap": "Open map",
  "detail.badge": "Santo accommodation",
  "detail.chooseThisRoom": "Choose this room",
  "detail.checkDates": "Check dates",
  "detail.photoAlt": "{name} photo {index}",
  "detail.viewPhoto": "View room photo {index}",
  "detail.spaceTitle": "Space to settle in.",
  "detail.spaceBody1":
    "Natural materials, soft textures, and a beautifully considered layout. The {name} pairs a restful sleeping area with thoughtful spaces for the moments in between.",
  "detail.spaceBody2":
    "From a quiet morning coffee to the last chapter of a good book, make room for a stay at your own pace.",
  "detail.comforts": "Considered comforts",
  "detail.chooseRoom": "Choose your room",
  "detail.searchFailed": "That stay could not be checked — please try again.",
  "detail.noneFree":
    "No {name} rooms are free for these dates. Try different dates or explore another room type.",
  "detail.continueBooking": "Continue to booking",
  "detail.faq.checkInTitle": "Check-in & check-out",
  "detail.faq.checkInBody": "Check-in from {inTime}, check-out by {outTime}.",
  "detail.faq.cancellationTitle": "Cancellation & payment",
  "detail.faq.cancellationBody":
    "Free cancellation up to {hours} hours before check-in. Payment is completed through the hotel's secure payment page.",
  "detail.faq.accessibilityTitle": "Accessibility",
  "detail.faq.accessibilityBody":
    "Room-specific accessibility information is available from our team. Please contact the hotel before making travel arrangements.",
  "detail.faq.houseRulesTitle": "House rules",
  "detail.faq.houseRulesBody":
    "Smoking, pet, visitor and quiet-hour policies are confirmed by the hotel at check-in.",
  "summary.selectDates": "Select your dates",
  "summary.guestsLine": "{adults} adults · {children} children · {quantity} {unit}",
  "summary.room": "room",
  "summary.rooms": "rooms",
  "summary.yourDates": "Your dates, your way",
  "summary.priceNote": "Price for one room. Taxes and fees are confirmed at checkout.",
  "summary.selectDatesNote":
    "Select your dates to see live availability and the full stay total.",
  "summary.nightRow": "{rate} × {nights} {unit}",
  "summary.taxesRow": "Taxes ({percent}%)",
  "summary.serviceFeeRow": "Service fee",
  "summary.availableCount": "{count} {unit} available",
  "summary.noneAvailable": "No rooms available for these dates",
  "detail.mapTitle": "Where you'll be staying",

  // --- Search map ----------------------------------------------------------
  "map.demoNotice": "Demo map location · not the hotel's verified address",
  "map.canvasAria": "Map showing the location of {name}",
  "map.loading": "Loading map…",
  "map.errorTitle": "The map could not be loaded.",
  "map.errorBody":
    "The room list and booking flow are unaffected — every room is still reachable beside this pane.",
  "map.showPrices": "Show prices {label}",
  "map.hidePrices": "Hide prices",
  "map.cardAria": "{name} prices and availability",
  "map.closeCard": "Close prices and availability",
  "map.directions": "Get directions",
  "map.nightlyFrom": "Nightly rates from",
  "map.dateRange": "· {checkIn} → {checkOut} ({nights} {unit})",
  "map.noRooms":
    "No rooms match your current filters or dates. Widen the search to see what's available.",
  "map.available": "{count} {unit} available",
  "map.perNight": "per night",
  "map.stayTotal": "{total} for {nights} {unit}",
  "map.openGmaps": "Open in Google Maps",
  "map.unavailableTitle": "Map location unavailable",
  "map.unavailableBody":
    "The hotel's verified map position has not been set yet. The room list and booking flow are unaffected.",
  "map.from": "From",

  // --- Booking summary -----------------------------------------------------
  "summary.yourSelection": "YOUR SELECTION",
  "summary.totalStay": "Total stay",
  "summary.changeRoom": "Change room",

  // --- Checkout ------------------------------------------------------------
  "checkout.step.guest": "Guest details",
  "checkout.step.review": "Review booking",
  "checkout.step.confirm": "Confirmation",
  "checkout.guestTitle": "Guest details",
  "checkout.privacyNote": "Your details are used only to manage this reservation.",
  "checkout.firstName": "First name *",
  "checkout.lastName": "Last name *",
  "checkout.email": "Email address *",
  "checkout.phone": "Phone number",
  "checkout.idType": "ID type",
  "checkout.idTypePlaceholder": "Passport / national ID",
  "checkout.idNumber": "ID number",
  "checkout.requests": "Special requests (optional)",
  "checkout.requestsPlaceholder":
    "A little detail that would make your stay more comfortable",
  "checkout.requestsNote": "Requests are shared with the hotel team.",
  "checkout.secureTitle": "Secure reservation",
  "checkout.secureBody":
    "Free cancellation up to {hours} hours before check-in. Payment is completed after your reservation is reviewed.",
  "checkout.reviewStay": "Review your stay",
  "checkout.reviewTitle": "Review your details",
  "checkout.guestName": "Guest name",
  "checkout.stayRow": "Stay",
  "checkout.identification": "Identification",
  "checkout.editGuest": "Edit guest details",
  "checkout.paymentTitle": "Payment after confirmation",
  "checkout.paymentBody":
    "Your reservation is created first. You can then complete payment securely from the confirmation page.",
  "checkout.acceptTerms":
    "I confirm these details are correct and I accept the hotel's cancellation terms.",
  "checkout.back": "Back",
  "checkout.reserving": "Reserving…",
  "checkout.complete": "Complete reservation",

  // Checkout error codes ---------------------------------------------------
  "checkout.error.price_changed":
    "The price changed while you were booking. The totals above are current — please review and confirm again.",
  "checkout.error.unavailable":
    "Those rooms are no longer available for your dates. Please search again.",
  "checkout.error.account_required":
    "An account is required to book online — please sign in first.",
  "checkout.error.check_in_past":
    "That stay would start in the past — please choose new dates.",
  "checkout.error.promotion_not_found": "That promotion code does not exist.",
  "checkout.error.promotion_inactive": "That promotion is not currently active.",
  "checkout.error.promotion_expired": "That promotion is no longer valid.",
  "checkout.error.promotion_exhausted": "That promotion has been fully redeemed.",
  "checkout.error.too_many_rooms":
    "That is more rooms than a single reservation may hold.",
  "checkout.error.invalid_body": "Please check the form fields and try again.",
  "checkout.error.internal":
    "Something went wrong creating the reservation. Please try again.",
  "checkout.error.fallback": "The reservation could not be completed.",

  // --- Cancellation button -------------------------------------------------
  "cancel.confirm": "Cancel this reservation?",
  "cancel.busy": "Cancelling…",
  "cancel.action": "Cancel reservation",
  "cancel.error.too_late_to_cancel": "The free cancellation window has already passed.",
  "cancel.error.not_cancellable": "This reservation can no longer be cancelled.",
  "cancel.error.guest_cancellation_disabled":
    "Online cancellation is disabled — please contact the hotel.",
  "cancel.error.not_found": "This reservation could not be found.",
  "cancel.error.internal": "Something went wrong. Please try again.",

  // --- Confirmation / payment ---------------------------------------------
  "confirmation.print": "Print confirmation",
  "pay.processing": "Processing…",
  "pay.now": "Pay now",
  "pay.simulateDecline": "Simulate declined card",
  "pay.error.declined": "The payment could not be completed. Please try again.",
  "pay.error.recorded": "The simulated decline was recorded.",
  "pay.error.internal": "Something went wrong. Please try again.",

  // --- Hotel info / contact ------------------------------------------------
  "hotel.hero.alt": "The welcoming Santo lobby",
  "hotel.hero.eyebrow": "GET TO KNOW SANTO",
  "hotel.hero.title1": "Thoughtful by nature.",
  "hotel.hero.title2": "Welcoming at heart.",
  "hotel.hero.body": "A place for the moments that matter.",
  "hotel.breadcrumb.contact": "Contact",
  "hotel.breadcrumb.hotel": "The Hotel",
  "hotel.addressFallback": "Hotel address to be confirmed",
  "hotel.intro.eyebrow": "THE SANTO WAY",
  "hotel.intro.title1": "A little less ordinary.",
  "hotel.intro.title2": "A little more you.",
  "hotel.intro.body":
    "At Santo, the idea is simple: beautiful spaces, considered comforts, and a welcome that feels genuine. A place to pause, connect, and settle into your own rhythm.",
  "hotel.galleryLabel": "Open property photo {index}",
  "hotel.amenities.eyebrow": "ROOM TO ENJOY",
  "hotel.amenities.title": "Considered comforts, throughout.",
  "hotel.amenities.note": "Ask our team for the latest details during your stay.",
  "hotel.amenity.dining": "Dining & gathering",
  "hotel.amenity.leisure": "Leisure & relaxation",
  "hotel.amenity.outdoor": "Outdoor spaces",
  "hotel.amenity.services": "Guest services",
  "hotel.faq.eyebrow": "GOOD TO KNOW",
  "hotel.faq.title": "A few helpful details.",
  "hotel.faq.q.checkIn": "When can I check in and check out?",
  "hotel.faq.a.checkIn": "Check-in is from {inTime} and check-out is by {outTime}.",
  "hotel.faq.q.cancellation": "What is the cancellation policy?",
  "hotel.faq.a.cancellation":
    "Free cancellation is available up to {hours} hours before check-in. Later cancellations are subject to the hotel's terms.",
  "hotel.faq.q.accessible": "Are accessible rooms available?",
  "hotel.faq.a.accessible":
    "Room accessibility and step-free facilities vary by room type. Please contact the hotel before planning your visit.",
  "hotel.faq.q.houseRules": "What are the house rules?",
  "hotel.faq.a.houseRules":
    "Smoking, pet, visitor and quiet-hour policies are confirmed by the hotel at check-in.",
  "hotel.faq.q.requests": "Can I make a special request?",
  "hotel.faq.a.requests":
    "Yes — add your request during checkout or contact the hotel directly. Requests are subject to availability.",
  "hotel.bottomTitle": "Find your own Santo moment.",
  "hotel.exploreRooms": "Explore our rooms",

  // --- Contact -------------------------------------------------------------
  "contact.eyebrow": "WE'D LOVE TO HEAR FROM YOU",
  "contact.title": "Every stay starts with hello.",
  "contact.description": "A question, a special occasion, or a little help planning your stay.",
  "contact.connectEyebrow": "LET'S CONNECT",
  "contact.connectTitle1": "A warm welcome",
  "contact.connectTitle2": "is just the beginning.",
  "contact.connectBody":
    "For booking assistance or questions about your stay, our team is here to help.",
  "contact.findUs": "Find us",
  "contact.writeUs": "Write to us",
  "contact.callUs": "Give us a call",
  "contact.emailFallback": "Email address to be confirmed",
  "contact.phoneFallback": "Phone number to be confirmed",
  "contact.mapNote": "Exact directions confirmed at booking",
  "contact.formTitle": "A little note for our team",
  "contact.formNote":
    "This form opens your email app so your message reaches the hotel directly.",
  "contact.name": "Your name *",
  "contact.email": "Email address *",
  "contact.subjectLabel": "What's on your mind?",
  "contact.messageLabel": "Your message *",
  "contact.messagePlaceholder": "How can we make your stay more considered?",
  "contact.send": "Send message",
  "contact.subjectDefault": "General enquiry",
  "contact.subjectBooking": "Booking assistance",
  "contact.subjectAccessibility": "Accessibility",
  "contact.subjectOccasion": "Special occasion",
  "contact.mailtoBody": "Name: {name}\nEmail: {email}\n\n{message}",
  "contact.noEmail": "Our email address is being confirmed. Please call the hotel for now.",
  "contact.openedApp": "Your email app should open with your message ready to send.",

  // --- Offers page ---------------------------------------------------------
  "offers.hero.alt": "A peaceful courtyard pool",
  "offers.hero.eyebrow": "A LITTLE SOMETHING MORE",
  "offers.hero.title1": "More reasons",
  "offers.hero.title2": "to make it Santo.",
  "offers.hero.body": "Thoughtful ideas for a stay that feels like you.",
  "offers.eyebrow": "CURATED STAYS",
  "offers.title": "Your time. Beautifully spent.",
  "offers.note": "Ask our reservations team about dates, eligibility and inclusions.",
  "offers.dialogTitle": "A stay to look forward to",
  "offers.dialogBody":
    "This package brings together a beautiful room and time to enjoy it. Contact our team to confirm the details for your dates.",
  "offers.applicableDates": "Applicable dates",
  "offers.eligibility": "Eligibility",
  "offers.termsInclusions": "Terms & inclusions",
  "offers.contactHotel": "Contact the hotel",
  "offers.confirmedAtBooking": "Confirmed at booking",
  "offers.exploreAccommodation": "Explore accommodation",

  // --- Page metadata (browser tab titles) ---------------------------------
  "meta.rooms.title": "Rooms & Suites",
  "meta.rooms.description":
    "Find your perfect stay in the Santo Hotel room and suite collection. Explore accommodation, amenities and rates.",
  "meta.search.title": "Find your stay",
  "meta.search.description": "Explore live room availability for your selected Santo Hotel stay.",
  "meta.offers.title": "A little something more",
  "meta.offers.description": "Discover Santo Hotel stay packages and thoughtful ideas for your next escape.",
  "meta.hotel.title": "The Santo way",
  "meta.hotel.description":
    "Get to know the Santo Hotel concept, property spaces, guest information and frequently asked questions.",
  "meta.contact.title": "Say hello",
  "meta.contact.description":
    "Contact Santo Hotel for booking assistance, accessibility questions and special occasions.",

  // --- Shared policy note --------------------------------------------------
  "policy.freeCancellation": "Free cancellation up to {hours} hours before arrival",
  "policy.freeCancellationCheckIn":
    "Free cancellation up to {hours} hours before check-in.",

  // --- Booking page --------------------------------------------------------
  "booking.backToRooms": "Back to rooms",
  "booking.eyebrow": "A FEW THOUGHTFUL DETAILS",
  "booking.title": "Your stay, coming together.",
  "booking.description":
    "Review your selection and complete your guest details. Your reservation is confirmed before payment.",
  "booking.failureTitle": "We couldn't hold those rooms.",
  "booking.failureFallback": "Those rooms cannot be booked for the selected dates.",
  "booking.searchOther": "Search other rooms",
  "booking.lineRow": "{type} · Room {number}",
  "booking.discount": "Discount",
  "booking.discountCode": "Discount ({code})",
  "booking.taxes": "Taxes",
  "booking.serviceFee": "Service fee",
  "booking.moreRooms": "{type} + {count} more",
  "booking.guestsLine": "{adults} {adultUnit} · {children} {childUnit} · {rooms} {roomUnit}",

  // Quote error codes -------------------------------------------------------
  "quote.error.room_not_found": "One of the selected rooms no longer exists.",
  "quote.error.invalid_date_range": "Check-out must be after check-in.",
  "quote.error.stay_too_long": "That stay is longer than the 60-night limit.",

  // --- Login ---------------------------------------------------------------
  "login.breadcrumb": "Sign in",
  "login.eyebrow": "YOUR OWN LITTLE CORNER OF SANTO",
  "login.title": "Welcome back.",
  "login.description": "Your stays, your details, all in one place.",
  "login.expired": "Your session has expired or was revoked. Please sign in again.",
  "login.error.invalid": "Invalid credentials",
  "login.error.rate_limited":
    "Too many failed attempts — please wait a few minutes and try again.",
  "login.email": "Email address",
  "login.password": "Password",
  "login.emailPlaceholder": "you@example.com",
  "login.signIn": "Sign in",
  "login.newToSanto": "New to Santo?",
  "login.createAccount": "Create a guest account",
  "login.staffTitle": "Staff & administrator sign in",
  "login.staffEmail": "Staff email",
  "login.staffSignIn": "Sign in to the console",

  // --- Signup --------------------------------------------------------------
  "signup.breadcrumb": "Create an account",
  "signup.eyebrow": "YOUR OWN LITTLE CORNER OF SANTO",
  "signup.title": "Make yourself at home.",
  "signup.description": "Keep your stays and details together.",
  "signup.error.exists": "Email already registered",
  "signup.error.invalid":
    "Invalid details — check your name, email and password requirements.",
  "signup.disabledTitle": "Guest accounts are currently unavailable.",
  "signup.disabledBody": "Please contact the hotel to complete a booking.",
  "signup.firstName": "First name",
  "signup.lastName": "Last name",
  "signup.email": "Email address",
  "signup.password": "Password (8+ characters, with a number)",
  "signup.create": "Create account",
  "signup.haveAccount": "Already have an account?",
  "signup.signIn": "Sign in",

  // --- Account -------------------------------------------------------------
  "account.breadcrumb": "My Santo",
  "account.eyebrow": "MY SANTO",
  "account.welcome": "Welcome back, {name}.",
  "account.guestName": "guest",
  "account.description": "Your stays, your details, all in one place.",
  "account.nav.overview": "Overview",
  "account.nav.bookings": "My bookings",
  "account.nav.profile": "Profile details",
  "account.nav.signOut": "Sign out",
  "account.profileTitle": "Your details",
  "account.profileNote": "Contact the hotel to update your profile details.",
  "account.name": "Name",
  "account.email": "Email address",
  "account.contactHotel": "Contact the hotel",
  "account.nextStay": "Your next stay",
  "account.liveReservations": "Live reservations",
  "account.noUpcoming": "No upcoming stays yet.",
  "account.noUpcomingBody": "Your next Santo moment is waiting to be planned.",
  "account.exploreRooms": "Explore rooms",
  "account.pastStays": "Past stays",
  "account.noPast": "No past stays yet.",
  "account.santoStay": "Santo stay",
  "account.viewReservation": "View reservation",
  "account.cancelUnavailable": "Online cancellation is no longer available.",
  "account.total": "Total: {total}",
  "account.reference": "Reference: {ref}",

  // Booking / payment status labels (enum → readable) -----------------------
  "status.booking.PENDING": "Pending",
  "status.booking.CONFIRMED": "Confirmed",
  "status.booking.CHECKED_IN": "Checked in",
  "status.booking.CHECKED_OUT": "Checked out",
  "status.booking.CANCELLED": "Cancelled",
  "status.booking.NO_SHOW": "No show",
  "status.payment.PENDING": "Pending",
  "status.payment.PAID": "Paid",
  "status.payment.FAILED": "Failed",
  "status.payment.REFUNDED": "Refunded",
  "status.payment.PARTIALLY_REFUNDED": "Partially refunded",

  // --- Booking confirmation ------------------------------------------------
  "confirmation.emptyTitle": "Booking confirmation",
  "confirmation.emptyBody": "No reservation reference was provided.",
  "confirmation.backHome": "Back to the hotel",
  "confirmation.notFoundTitle": "We couldn't find that reservation.",
  "confirmation.notFoundBody": "Reservation {ref} is not available for this browser or account.",
  "confirmation.searchRooms": "Search rooms",
  "confirmation.eyebrow.cancelled": "RESERVATION CANCELLED",
  "confirmation.eyebrow.success": "SOMETHING TO LOOK FORWARD TO",
  "confirmation.title.cancelled": "Your reservation was cancelled.",
  "confirmation.title.success": "Your Stay at Santo Hotel",
  "confirmation.body.cancelled": "We hope to welcome you another time.",
  "confirmation.body.success": "A little escape, thoughtfully put together.",
  "confirmation.referenceBadge": "Reference {ref} · {status}",
  "confirmation.detailsEyebrow": "RESERVATION DETAILS",
  "confirmation.guest": "Guest",
  "confirmation.stay": "Stay",
  "confirmation.party": "Party",
  "confirmation.paymentStatus": "Payment status",
  "confirmation.cancellation": "Cancellation",
  "confirmation.until": "Until {when} UTC",
  "confirmation.cancelledNotice":
    "This reservation has been cancelled and no further action is required.",
  "confirmation.paidNotice": "Your reservation is paid in full. We look forward to welcoming you.",
  "confirmation.heldNotice": "Your reservation is held. Complete payment to confirm your stay.",
  "confirmation.payNow": "Pay {amount} now",
  "confirmation.yourRequests": "Your requests",
  "confirmation.viewBookings": "View my bookings",
  "confirmation.returnHome": "Return to homepage",
  "confirmation.freeCancellationUntil": "Free cancellation until {when} UTC.",
  "confirmation.cancellationTerms": "Cancellation terms are confirmed by the hotel.",

  // --- Payment page --------------------------------------------------------
  "pay.backToConfirmation": "Back to confirmation",
  "pay.eyebrow": "SECURE PAYMENT",
  "pay.title.paid": "This reservation is paid.",
  "pay.title.cancelled": "This reservation was cancelled.",
  "pay.title.due": "Complete your payment.",
  "pay.description": "Reservation {ref} · {checkIn} → {checkOut}",
  "pay.amountDue": "AMOUNT DUE",
  "pay.secureTitle": "Secure payment",
  "pay.secureBody":
    "Complete your payment to confirm the reservation. Your rooms are held while payment is processed.",
  "pay.paidNotice": "No further payment is due. We look forward to welcoming you.",
  "pay.cancelledNotice": "This reservation has been cancelled and cannot be paid online.",
  "pay.note": "Payment is processed through the hotel's secure payment page.",

  // Server-side fallbacks when the admin content slots are empty ----------
  "home.addressFallback": "Hotel address to be confirmed.",
  "home.heroTitleFallback": "Your Stay, Thoughtfully Designed.",
  "home.heroBodyFallback":
    "Discover comfort, exceptional hospitality, and a stay tailored to you at Santo Hotel.",
} as const;

/**
 * Every key the site may translate. Other locales are partials of this.
 *
 * Keys are strict (a typo is a compile error) but values widen to `string`,
 * because `en` is `as const` and French/Arabic obviously differ from the
 * English literal.
 */
export type Dictionary = { [K in keyof typeof en]: string };
