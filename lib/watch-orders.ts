import { titleDetails, watchOrderEntryImage, watchOrderTitleDetails } from "./tmdb";
import type {
  MediaType,
  Title,
  WatchOrderDetails,
  WatchOrderEntry,
  WatchOrderMode,
  WatchOrderSummary,
} from "./types";

type WatchOrderDefinition = Omit<WatchOrderSummary, "entryCount"> & {
  modes: WatchOrderMode[];
  detailLevel?: "full" | "catalog";
};

const entry = (
  id: string,
  title: string,
  description: string,
  year: string,
  kind: WatchOrderEntry["kind"],
  mediaType: MediaType,
  tmdbId: number,
  extra: Partial<Pick<WatchOrderEntry, "imagePath" | "seasonNumber" | "imageEpisodeNumber" | "seasonLabel" | "episodeRange" | "optional" | "note">> = {},
): WatchOrderEntry => ({ id, title, description, year, kind, mediaType, tmdbId, ...extra });

const SAO_SAFE_MAIN_IMAGE = "/yFZG86Zvdy6JuIlMW9eHxlVkct5.jpg";

const swordArtStory = [
  entry("sao-opening", "Sword Art Online – Einstieg in Aincrad", "Sieh zuerst die ersten drei Folgen. Sie erklären das Spiel, seine Regeln und Kiritos Ausgangslage, bevor die ausführlicheren Progressive-Filme folgen.", "2012", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 1 · Aincrad", episodeRange: "Folgen 1–3", note: "Danach mit den beiden Progressive-Filmen fortfahren" }),
  entry("sao-progressive-aria", "Progressive: Aria of a Starless Night", "Die frühe Aincrad-Zeit wird ausführlicher aus Asunas Perspektive erzählt und ergänzt wichtige Zusammenhänge.", "2021", "movie", "movie", 761898, { imagePath: "/qKVOTKPPtvoXd75L1HOSBPLtKWS.jpg", note: "Nach Folge 3 ansehen" }),
  entry("sao-progressive-scherzo", "Progressive: Scherzo of Deep Night", "Die Progressive-Handlung geht auf der fünften Ebene von Aincrad weiter.", "2022", "movie", "movie", 893712, { imagePath: "/sIsABtZxFBm1IOVOGocd4iPySyg.jpg", note: "Direkt nach Progressive: Aria" }),
  entry("sao-aincrad-rest", "Sword Art Online – Aincrad fortsetzen", "Kehre nach den Progressive-Filmen zur Hauptserie zurück und schließe den Aincrad-Handlungsbogen ab.", "2012", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 1 · Aincrad", episodeRange: "Folgen 4–14" }),
  entry("sao-fairy-dance", "Sword Art Online – Fairy Dance", "Die direkte Fortsetzung führt nach ALfheim Online und schließt die erste Staffel ab.", "2012", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 1 · Fairy Dance", episodeRange: "Folgen 15–25" }),
  entry("sao-extra", "Sword Art Online: Extra Edition", "Rückblick auf Aincrad und Fairy Dance mit einer zusätzlichen Nebengeschichte.", "2013", "special", "movie", 1012404, { imagePath: SAO_SAFE_MAIN_IMAGE, optional: true, note: "Optional – größtenteils Rückblick" }),
  entry("sao-ii", "Sword Art Online II", "Phantom Bullet, Calibur und Mother's Rosario setzen Kiritos und Asunas Geschichte fort.", "2014", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 2" }),
  entry("sao-ggo-s1", "Alternative: Gun Gale Online", "Eigenständiger Spin-off im GGO-Universum mit LLENN. Funktioniert am besten nach Sword Art Online II.", "2018", "alternative", "tv", 78204, { imagePath: "/rJ3WMubG6K6I3j8xjatGgefBWsc.jpg", seasonLabel: "Staffel 1", optional: true, note: "Optionaler Spin-off" }),
  entry("sao-ordinal", "Sword Art Online: Ordinal Scale", "Der Kinofilm spielt nach Sword Art Online II und ist für Alicization relevant.", "2017", "movie", "movie", 413594, { imagePath: SAO_SAFE_MAIN_IMAGE }),
  entry("sao-alicization", "Sword Art Online: Alicization", "Kirito erwacht in der geheimnisvollen virtuellen Welt Underworld.", "2018", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 3 · Alicization" }),
  entry("sao-war-1", "Alicization – War of Underworld", "Der Krieg um Underworld beginnt und führt Alicization unmittelbar weiter.", "2019", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 4 · Teil 1" }),
  entry("sao-war-2", "Alicization – War of Underworld: Final Season", "Der zweite Teil schließt die Alicization-Handlung ab.", "2020", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 4 · Teil 2" }),
  entry("sao-ggo-s2", "Alternative: Gun Gale Online II", "LLENNs eigenständiges Abenteuer in Gun Gale Online geht weiter.", "2024", "alternative", "tv", 78204, { imagePath: "/rJ3WMubG6K6I3j8xjatGgefBWsc.jpg", seasonLabel: "Staffel 2", optional: true, note: "Optionaler Spin-off" }),
];

const swordArtRelease = [
  entry("sao-release-s1", "Sword Art Online – Staffel 1", "Aincrad und Fairy Dance in der ursprünglichen Serienfassung.", "2012", "season", "tv", 45782, { imagePath: SAO_SAFE_MAIN_IMAGE, seasonLabel: "Staffel 1", episodeRange: "Folgen 1–25" }),
  swordArtStory[5], swordArtStory[6], swordArtStory[8], swordArtStory[7], swordArtStory[9],
  swordArtStory[10], swordArtStory[11], swordArtStory[1], swordArtStory[2], swordArtStory[12],
];

const attackOrder = [
  entry("aot-s1", "Attack on Titan – Staffel 1", "Der Fall von Mauer Maria setzt Erens Kampf gegen die Titanen in Gang.", "2013", "season", "tv", 1429, { seasonLabel: "Staffel 1" }),
  entry("aot-s2", "Attack on Titan – Staffel 2", "Die Identität mehrerer Titanen und die Geheimnisse der Mauern rücken in den Mittelpunkt.", "2017", "season", "tv", 1429, { seasonLabel: "Staffel 2" }),
  entry("aot-s3-1", "Attack on Titan – Staffel 3, Teil 1", "Der Konflikt verlagert sich ins Innere der Mauern und enthüllt politische Wahrheiten.", "2018", "season", "tv", 1429, { seasonLabel: "Staffel 3 · Teil 1" }),
  entry("aot-s3-2", "Attack on Titan – Staffel 3, Teil 2", "Die Rückkehr nach Shiganshina beantwortet zentrale Fragen über die Welt.", "2019", "season", "tv", 1429, { seasonLabel: "Staffel 3 · Teil 2" }),
  entry("aot-final-1", "The Final Season – Teil 1", "Jenseits des Meeres beginnt eine neue Perspektive auf den alten Krieg.", "2020", "season", "tv", 1429, { seasonLabel: "Final Season · Teil 1" }),
  entry("aot-final-2", "The Final Season – Teil 2", "Eren setzt seinen Plan in Bewegung und die Fronten brechen endgültig auf.", "2022", "season", "tv", 1429, { seasonLabel: "Final Season · Teil 2" }),
  entry("aot-chapters", "The Final Chapters", "Die beiden abschließenden Specials beenden die Hauptgeschichte.", "2023", "special", "tv", 1429, { seasonLabel: "Final Chapters · Specials 1 & 2" }),
  entry("aot-last-attack", "Attack on Titan: The Last Attack", "Kinofassung der Final Chapters mit überarbeiteter Präsentation. Nicht zusätzlich nötig, wenn du die Specials gesehen hast.", "2024", "alternative", "movie", 1333100, { optional: true, note: "Alternative Kinofassung des Finales" }),
];

const demonSlayerStory = [
  entry("ds-s1", "Demon Slayer – Unwavering Resolve Arc", "Tanjiros Reise beginnt mit seiner Ausbildung und den ersten Missionen als Dämonenjäger.", "2019", "season", "tv", 85937, { seasonLabel: "Staffel 1" }),
  entry("ds-mugen-movie", "Mugen Train", "Der Kinofilm setzt direkt nach Staffel 1 ein und erzählt den Mugen-Train-Handlungsbogen kompakt.", "2020", "movie", "movie", 635302),
  entry("ds-mugen-tv", "Mugen Train Arc – Serienfassung", "Alternative Serienfassung des Films mit einer neuen Auftaktfolge und ergänzten Szenen.", "2021", "alternative", "tv", 85937, { seasonLabel: "Mugen Train Arc", optional: true, note: "Alternative zum Film – nicht beides erforderlich" }),
  entry("ds-entertainment", "Entertainment District Arc", "Tanjiro, Zenitsu und Inosuke begleiten Tengen Uzui in das Vergnügungsviertel.", "2021", "season", "tv", 85937, { seasonLabel: "Entertainment District Arc" }),
  entry("ds-swordsmith", "Swordsmith Village Arc", "Tanjiro reist in das Dorf der Schwertschmiede und trifft zwei weitere Säulen.", "2023", "season", "tv", 85937, { seasonLabel: "Swordsmith Village Arc" }),
  entry("ds-hashira", "Hashira Training Arc", "Das Training der Säulen bereitet das Korps auf den entscheidenden Kampf vor.", "2024", "season", "tv", 85937, { seasonLabel: "Hashira Training Arc" }),
  entry("ds-infinity-1", "Infinity Castle", "Der erste Kinofilm der Infinity-Castle-Trilogie führt die Geschichte unmittelbar weiter.", "2025", "movie", "movie", 1311031, { note: "Teil 1 der geplanten Filmtrilogie" }),
];

const demonSlayerRelease = [
  demonSlayerStory[0], demonSlayerStory[1], demonSlayerStory[2], demonSlayerStory[3],
  demonSlayerStory[4], demonSlayerStory[5], demonSlayerStory[6],
];

const movieEntry = (id: string, title: string, year: string, tmdbId: number, description: string, imagePath: string) => (
  entry(id, title, description, year, "movie", "movie", tmdbId, { imagePath })
);

const MCU_IMAGE = "/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg";
const mcuMovies = {
  ironMan: movieEntry("mcu-iron-man", "Iron Man", "2008", 1726, "Tony Stark baut die erste Iron-Man-Rüstung und eröffnet das MCU.", MCU_IMAGE),
  hulk: movieEntry("mcu-hulk", "Der unglaubliche Hulk", "2008", 1724, "Bruce Banner sucht nach einem Weg, den Hulk zu kontrollieren.", MCU_IMAGE),
  ironMan2: movieEntry("mcu-iron-man-2", "Iron Man 2", "2010", 10138, "Tony Stark stellt sich den Folgen seiner öffentlich gewordenen Identität.", MCU_IMAGE),
  thor: movieEntry("mcu-thor", "Thor", "2011", 10195, "Thor wird auf die Erde verbannt und lernt Demut.", MCU_IMAGE),
  firstAvenger: movieEntry("mcu-first-avenger", "Captain America: The First Avenger", "2011", 1771, "Steve Rogers kämpft während des Zweiten Weltkriegs gegen HYDRA.", MCU_IMAGE),
  avengers: movieEntry("mcu-avengers", "Marvel's The Avengers", "2012", 24428, "Die ersten Avengers müssen gemeinsam Lokis Angriff stoppen.", MCU_IMAGE),
  ironMan3: movieEntry("mcu-iron-man-3", "Iron Man 3", "2013", 68721, "Tony verarbeitet die Folgen der Schlacht von New York.", MCU_IMAGE),
  darkWorld: movieEntry("mcu-thor-dark-world", "Thor: The Dark Kingdom", "2013", 76338, "Thor stellt sich den Dunkelelfen und einer uralten Macht.", MCU_IMAGE),
  winterSoldier: movieEntry("mcu-winter-soldier", "The Return of the First Avenger", "2014", 100402, "Steve deckt eine Verschwörung innerhalb von S.H.I.E.L.D. auf.", MCU_IMAGE),
  guardians: movieEntry("mcu-guardians", "Guardians of the Galaxy", "2014", 118340, "Eine ungewöhnliche Gruppe wird zu den Guardians of the Galaxy.", MCU_IMAGE),
  guardians2: movieEntry("mcu-guardians-2", "Guardians of the Galaxy Vol. 2", "2017", 283995, "Peter Quill erfährt mehr über seine Herkunft.", MCU_IMAGE),
  ultron: movieEntry("mcu-ultron", "Avengers: Age of Ultron", "2015", 99861, "Ein missglücktes Schutzprogramm erschafft den Gegner Ultron.", MCU_IMAGE),
  antMan: movieEntry("mcu-ant-man", "Ant-Man", "2015", 102899, "Scott Lang übernimmt den Ant-Man-Anzug.", MCU_IMAGE),
  civilWar: movieEntry("mcu-civil-war", "The First Avenger: Civil War", "2016", 271110, "Die Avengers zerbrechen am Streit über staatliche Kontrolle.", MCU_IMAGE),
  doctorStrange: movieEntry("mcu-doctor-strange", "Doctor Strange", "2016", 284052, "Stephen Strange entdeckt die mystischen Künste.", MCU_IMAGE),
  homecoming: movieEntry("mcu-homecoming", "Spider-Man: Homecoming", "2017", 315635, "Peter Parker versucht, sich als junger Held zu beweisen.", MCU_IMAGE),
  blackPanther: movieEntry("mcu-black-panther", "Black Panther", "2018", 284054, "T'Challa tritt sein Erbe als König von Wakanda an.", MCU_IMAGE),
  ragnarok: movieEntry("mcu-ragnarok", "Thor: Tag der Entscheidung", "2017", 284053, "Thor muss Asgard vor Ragnarök retten.", MCU_IMAGE),
  infinityWar: movieEntry("mcu-infinity-war", "Avengers: Infinity War", "2018", 299536, "Thanos beginnt seinen Angriff auf das gesamte Universum.", MCU_IMAGE),
  antManWasp: movieEntry("mcu-ant-man-wasp", "Ant-Man and the Wasp", "2018", 363088, "Scott Lang kehrt in die Quantenwelt zurück.", MCU_IMAGE),
  captainMarvel: movieEntry("mcu-captain-marvel", "Captain Marvel", "2019", 299537, "Carol Danvers' Ursprung führt zurück in das Jahr 1995.", MCU_IMAGE),
  endgame: movieEntry("mcu-endgame", "Avengers: Endgame", "2019", 299534, "Die verbliebenen Avengers versuchen, Thanos' Tat rückgängig zu machen.", MCU_IMAGE),
  farFromHome: movieEntry("mcu-far-from-home", "Spider-Man: Far From Home", "2019", 429617, "Peter Parker lebt mit den Folgen von Endgame.", MCU_IMAGE),
};

const mcuStory = [
  mcuMovies.firstAvenger, mcuMovies.captainMarvel, mcuMovies.ironMan, mcuMovies.ironMan2,
  mcuMovies.hulk, mcuMovies.thor, mcuMovies.avengers, mcuMovies.ironMan3,
  mcuMovies.darkWorld, mcuMovies.winterSoldier, mcuMovies.guardians, mcuMovies.guardians2,
  mcuMovies.ultron, mcuMovies.antMan, mcuMovies.civilWar, mcuMovies.blackPanther,
  mcuMovies.homecoming, mcuMovies.doctorStrange, mcuMovies.ragnarok, mcuMovies.antManWasp,
  mcuMovies.infinityWar, mcuMovies.endgame, mcuMovies.farFromHome,
];

const mcuRelease = [
  mcuMovies.ironMan, mcuMovies.hulk, mcuMovies.ironMan2, mcuMovies.thor,
  mcuMovies.firstAvenger, mcuMovies.avengers, mcuMovies.ironMan3, mcuMovies.darkWorld,
  mcuMovies.winterSoldier, mcuMovies.guardians, mcuMovies.ultron, mcuMovies.antMan,
  mcuMovies.civilWar, mcuMovies.doctorStrange, mcuMovies.guardians2, mcuMovies.homecoming,
  mcuMovies.ragnarok, mcuMovies.blackPanther, mcuMovies.infinityWar, mcuMovies.antManWasp,
  mcuMovies.captainMarvel, mcuMovies.endgame, mcuMovies.farFromHome,
];

const STAR_WARS_IMAGE = "/yUiXA68FfQeA8cRBhd0Ao0jIRZt.jpg";
const starWarsMovies = {
  ep1: movieEntry("sw-ep1", "Episode I – Die dunkle Bedrohung", "1999", 1893, "Anakin Skywalkers Weg beginnt auf Tatooine.", STAR_WARS_IMAGE),
  ep2: movieEntry("sw-ep2", "Episode II – Angriff der Klonkrieger", "2002", 1894, "Die Klonkriege kündigen sich an.", STAR_WARS_IMAGE),
  cloneWars: movieEntry("sw-clone-wars", "Star Wars: The Clone Wars", "2008", 12180, "Der Animationsfilm führt in die gleichnamige Serie ein.", STAR_WARS_IMAGE),
  ep3: movieEntry("sw-ep3", "Episode III – Die Rache der Sith", "2005", 1895, "Anakins Fall verändert die Galaxis.", STAR_WARS_IMAGE),
  solo: movieEntry("sw-solo", "Solo: A Star Wars Story", "2018", 348350, "Han Solos frühe Jahre vor der Rebellion.", STAR_WARS_IMAGE),
  rogueOne: movieEntry("sw-rogue-one", "Rogue One: A Star Wars Story", "2016", 330459, "Die Rebellen beschaffen die Pläne des Todessterns.", STAR_WARS_IMAGE),
  ep4: movieEntry("sw-ep4", "Episode IV – Eine neue Hoffnung", "1977", 11, "Luke Skywalker schließt sich der Rebellion an.", STAR_WARS_IMAGE),
  ep5: movieEntry("sw-ep5", "Episode V – Das Imperium schlägt zurück", "1980", 1891, "Das Imperium jagt die Rebellen und Luke sucht Yoda.", STAR_WARS_IMAGE),
  ep6: movieEntry("sw-ep6", "Episode VI – Die Rückkehr der Jedi-Ritter", "1983", 1892, "Luke stellt sich Darth Vader und dem Imperator.", STAR_WARS_IMAGE),
  ep7: movieEntry("sw-ep7", "Episode VII – Das Erwachen der Macht", "2015", 140607, "Rey gerät in den Konflikt mit der Ersten Ordnung.", STAR_WARS_IMAGE),
  ep8: movieEntry("sw-ep8", "Episode VIII – Die letzten Jedi", "2017", 181808, "Rey sucht Lukes Hilfe, während der Widerstand flieht.", STAR_WARS_IMAGE),
  ep9: movieEntry("sw-ep9", "Episode IX – Der Aufstieg Skywalkers", "2019", 181812, "Die Skywalker-Saga erreicht ihr Finale.", STAR_WARS_IMAGE),
};
const starWarsStory = [starWarsMovies.ep1, starWarsMovies.ep2, starWarsMovies.cloneWars, starWarsMovies.ep3, starWarsMovies.solo, starWarsMovies.rogueOne, starWarsMovies.ep4, starWarsMovies.ep5, starWarsMovies.ep6, starWarsMovies.ep7, starWarsMovies.ep8, starWarsMovies.ep9];
const starWarsRelease = [starWarsMovies.ep4, starWarsMovies.ep5, starWarsMovies.ep6, starWarsMovies.ep1, starWarsMovies.ep2, starWarsMovies.ep3, starWarsMovies.cloneWars, starWarsMovies.ep7, starWarsMovies.rogueOne, starWarsMovies.ep8, starWarsMovies.solo, starWarsMovies.ep9];

const WIZARDING_IMAGE = "/1XAC6RPT01UX9EQGy2JVn5c8pgy.jpg";
const wizardingMovies = {
  beasts1: movieEntry("ww-beasts-1", "Phantastische Tierwesen und wo sie zu finden sind", "2016", 259316, "Newt Scamanders Abenteuer beginnt 1926 in New York.", WIZARDING_IMAGE),
  beasts2: movieEntry("ww-beasts-2", "Phantastische Tierwesen: Grindelwalds Verbrechen", "2018", 338952, "Grindelwalds Einfluss wächst in Europa.", WIZARDING_IMAGE),
  beasts3: movieEntry("ww-beasts-3", "Phantastische Tierwesen: Dumbledores Geheimnisse", "2022", 338953, "Dumbledore stellt ein Team gegen Grindelwald zusammen.", WIZARDING_IMAGE),
  hp1: movieEntry("ww-hp-1", "Harry Potter und der Stein der Weisen", "2001", 671, "Harry entdeckt Hogwarts und die magische Welt.", WIZARDING_IMAGE),
  hp2: movieEntry("ww-hp-2", "Harry Potter und die Kammer des Schreckens", "2002", 672, "Eine dunkle Macht bedroht Hogwarts.", WIZARDING_IMAGE),
  hp3: movieEntry("ww-hp-3", "Harry Potter und der Gefangene von Askaban", "2004", 673, "Sirius Black entkommt aus Askaban.", WIZARDING_IMAGE),
  hp4: movieEntry("ww-hp-4", "Harry Potter und der Feuerkelch", "2005", 674, "Harry nimmt am Trimagischen Turnier teil.", WIZARDING_IMAGE),
  hp5: movieEntry("ww-hp-5", "Harry Potter und der Orden des Phönix", "2007", 675, "Der Orden bereitet sich auf Voldemorts Rückkehr vor.", WIZARDING_IMAGE),
  hp6: movieEntry("ww-hp-6", "Harry Potter und der Halbblutprinz", "2009", 767, "Dumbledore zeigt Harry Voldemorts Vergangenheit.", WIZARDING_IMAGE),
  hp7: movieEntry("ww-hp-7", "Harry Potter und die Heiligtümer des Todes – Teil 1", "2010", 12444, "Harry, Ron und Hermine suchen die Horkruxe.", WIZARDING_IMAGE),
  hp8: movieEntry("ww-hp-8", "Harry Potter und die Heiligtümer des Todes – Teil 2", "2011", 12445, "Die Schlacht um Hogwarts beendet die Hauptgeschichte.", WIZARDING_IMAGE),
};
const wizardingStory = [wizardingMovies.beasts1, wizardingMovies.beasts2, wizardingMovies.beasts3, wizardingMovies.hp1, wizardingMovies.hp2, wizardingMovies.hp3, wizardingMovies.hp4, wizardingMovies.hp5, wizardingMovies.hp6, wizardingMovies.hp7, wizardingMovies.hp8];
const wizardingRelease = [wizardingMovies.hp1, wizardingMovies.hp2, wizardingMovies.hp3, wizardingMovies.hp4, wizardingMovies.hp5, wizardingMovies.hp6, wizardingMovies.hp7, wizardingMovies.hp8, wizardingMovies.beasts1, wizardingMovies.beasts2, wizardingMovies.beasts3];

const MIDDLE_EARTH_IMAGE = "/oiwc338EoBgS4sEI2ixAny4KQKg.jpg";
const middleEarthMovies = {
  hobbit1: movieEntry("me-hobbit-1", "Der Hobbit: Eine unerwartete Reise", "2012", 49051, "Bilbo verlässt das Auenland mit Thorins Gemeinschaft.", MIDDLE_EARTH_IMAGE),
  hobbit2: movieEntry("me-hobbit-2", "Der Hobbit: Smaugs Einöde", "2013", 57158, "Die Reise führt zum Einsamen Berg und zu Smaug.", MIDDLE_EARTH_IMAGE),
  hobbit3: movieEntry("me-hobbit-3", "Der Hobbit: Die Schlacht der Fünf Heere", "2014", 122917, "Der Konflikt um Erebor erreicht seinen Höhepunkt.", MIDDLE_EARTH_IMAGE),
  lotr1: movieEntry("me-lotr-1", "Der Herr der Ringe: Die Gefährten", "2001", 120, "Frodo beginnt die Reise zur Vernichtung des Einen Rings.", MIDDLE_EARTH_IMAGE),
  lotr2: movieEntry("me-lotr-2", "Der Herr der Ringe: Die zwei Türme", "2002", 121, "Die Gemeinschaft ist getrennt, während der Krieg wächst.", MIDDLE_EARTH_IMAGE),
  lotr3: movieEntry("me-lotr-3", "Der Herr der Ringe: Die Rückkehr des Königs", "2003", 122, "Die Reise nach Mordor und der Ringkrieg enden.", MIDDLE_EARTH_IMAGE),
};
const middleEarthStory = [middleEarthMovies.hobbit1, middleEarthMovies.hobbit2, middleEarthMovies.hobbit3, middleEarthMovies.lotr1, middleEarthMovies.lotr2, middleEarthMovies.lotr3];
const middleEarthRelease = [middleEarthMovies.lotr1, middleEarthMovies.lotr2, middleEarthMovies.lotr3, middleEarthMovies.hobbit1, middleEarthMovies.hobbit2, middleEarthMovies.hobbit3];

const WATCH_ORDER_DEFINITIONS: WatchOrderDefinition[] = [
  {
    id: "sword-art-online",
    title: "Sword Art Online",
    eyebrow: "ANIME · SERIEN, FILME & SPIN-OFFS",
    description: "Die Hauptgeschichte von Aincrad bis Alicization – mit Progressive und Gun Gale Online klar als optionale Alternativen eingeordnet.",
    aliases: ["sao", "sword art online", "ordinal scale", "alicization", "gun gale online", "progressive"],
    category: "anime",
    titleRefs: ["tv:45782", "tv:78204", "movie:413594", "movie:761898", "movie:893712", "movie:1012404"],
    backdropPath: SAO_SAFE_MAIN_IMAGE,
    posterPath: "/d4eGqZiYPtTBthXH5Q7jjVXVbAC.jpg",
    accent: "#7057e8",
    updatedAt: "September 2026",
    modes: [
      { id: "story", label: "Empfohlene Reihenfolge", description: "Die Hauptgeschichte ohne unnötige Wiederholungen. Optionale Nacherzählungen und Spin-offs sind klar markiert.", entries: swordArtStory },
      { id: "release", label: "Veröffentlichung", description: "Alle Einträge in der Reihenfolge ihrer Erstveröffentlichung.", entries: swordArtRelease },
    ],
  },
  {
    id: "attack-on-titan",
    title: "Attack on Titan",
    eyebrow: "ANIME · VOLLSTÄNDIGE HAUPTHANDLUNG",
    description: "Von Staffel 1 bis zum Finale – inklusive Einordnung von The Last Attack als alternative Kinofassung.",
    aliases: ["attack on titan", "aot", "shingeki no kyojin", "the last attack"],
    category: "anime",
    titleRefs: ["tv:1429", "movie:1333100"],
    backdropPath: "/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg",
    posterPath: "/qlbcGr0EYKRICD0MTrIwnIztQna.jpg",
    accent: "#d66741",
    updatedAt: "September 2026",
    modes: [
      { id: "story", label: "Chronologisch", description: "Die fortlaufende Hauptgeschichte in ihrer erzählten Reihenfolge.", entries: attackOrder },
      { id: "release", label: "Veröffentlichung", description: "Bei Attack on Titan entspricht die Veröffentlichung der empfohlenen Hauptreihenfolge.", entries: attackOrder },
    ],
  },
  {
    id: "demon-slayer",
    title: "Demon Slayer",
    eyebrow: "ANIME · ARCS & KINOFILME",
    description: "Alle Handlungsbögen ab Tanjiros erster Mission – mit einer klaren Wahl zwischen Mugen-Train-Film und Serienfassung.",
    aliases: ["demon slayer", "kimetsu no yaiba", "mugen train", "infinity castle"],
    category: "anime",
    titleRefs: ["tv:85937", "movie:635302", "movie:1311031"],
    backdropPath: "/3GQKYh6Trm8pxd2AypovoYQf4Ay.jpg",
    posterPath: "/7Uj6vqmznWQ3w3hpQ1eIY9mMyMw.jpg",
    accent: "#24a48b",
    updatedAt: "September 2026",
    modes: [
      { id: "story", label: "Empfohlene Reihenfolge", description: "Folge der Handlung ohne Dopplungen. Die Mugen-Train-Serienfassung ist als Alternative zum Film markiert.", entries: demonSlayerStory },
      { id: "release", label: "Veröffentlichung", description: "Die Arcs und Filme in der Reihenfolge ihrer Erstveröffentlichung.", entries: demonSlayerRelease },
    ],
  },
  {
    id: "marvel-infinity-saga",
    title: "Marvel Cinematic Universe – Infinity Saga",
    eyebrow: "FILME · MARVEL STUDIOS · 23 KAPITEL",
    description: "Die vollständige Infinity Saga von Captain America und Iron Man bis Endgame und Far From Home.",
    aliases: ["marvel", "marvel studios", "mcu", "avengers", "infinity saga", "iron man", "captain america"],
    category: "film",
    titleRefs: [...new Set(mcuStory.map((item) => `${item.mediaType}:${item.tmdbId}`))],
    backdropPath: MCU_IMAGE,
    posterPath: "/ibO8Pj0aA1nwj3Q9FMpMcYZkdCA.jpg",
    accent: "#d95656",
    updatedAt: "September 2026",
    detailLevel: "catalog",
    modes: [
      { id: "story", label: "Chronologisch", description: "Die 23 Filme nach der internen Handlung geordnet. Zeitliche Überschneidungen sind auf eine verständliche Hauptlinie reduziert.", entries: mcuStory },
      { id: "release", label: "Veröffentlichung", description: "Die offizielle Infinity Saga in Kino-Veröffentlichungsreihenfolge von 2008 bis 2019.", entries: mcuRelease },
    ],
  },
  {
    id: "star-wars-filme",
    title: "Star Wars – Film-Saga",
    eyebrow: "FILME · SKYWALKER-SAGA & SPIN-OFFS",
    description: "Alle zwölf Kinofilme von Episode I bis IX – ergänzt um Clone Wars, Solo und Rogue One.",
    aliases: ["star wars", "skywalker", "krieg der sterne", "jedi", "rogue one", "solo"],
    category: "film",
    titleRefs: starWarsStory.map((item) => `${item.mediaType}:${item.tmdbId}`),
    backdropPath: STAR_WARS_IMAGE,
    posterPath: "/crUUE14AROxNWsMdmyyqZNcUB6L.jpg",
    accent: "#d1a84a",
    updatedAt: "September 2026",
    detailLevel: "catalog",
    modes: [
      { id: "story", label: "Chronologisch", description: "Die Filme entlang der galaktischen Zeitlinie. Rogue One führt direkt in Episode IV.", entries: starWarsStory },
      { id: "release", label: "Veröffentlichung", description: "Die Kinofilme in der Reihenfolge ihrer Veröffentlichung ab 1977.", entries: starWarsRelease },
    ],
  },
  {
    id: "wizarding-world",
    title: "Wizarding World",
    eyebrow: "FILME · PHANTASTISCHE TIERWESEN & HARRY POTTER",
    description: "Newt Scamanders Vorgeschichte und anschließend Harry Potters vollständige Hogwarts-Reise.",
    aliases: ["harry potter", "wizarding world", "phantastische tierwesen", "fantastic beasts", "hogwarts"],
    category: "film",
    titleRefs: wizardingStory.map((item) => `${item.mediaType}:${item.tmdbId}`),
    backdropPath: WIZARDING_IMAGE,
    posterPath: "/nKspzM3rVJASkT4CvZvuj9KDT7l.jpg",
    accent: "#477cc2",
    updatedAt: "September 2026",
    detailLevel: "catalog",
    modes: [
      { id: "story", label: "Chronologisch", description: "Zuerst die in den 1920er-Jahren beginnenden Phantastische-Tierwesen-Filme, danach Harry Potter 1 bis 8.", entries: wizardingStory },
      { id: "release", label: "Veröffentlichung", description: "Erst Harry Potters acht Filme, anschließend die drei Phantastische-Tierwesen-Filme.", entries: wizardingRelease },
    ],
  },
  {
    id: "middle-earth",
    title: "Mittelerde",
    eyebrow: "FILME · DER HOBBIT & DER HERR DER RINGE",
    description: "Bilbos Reise zum Einsamen Berg und danach Frodos Weg zur Vernichtung des Einen Rings.",
    aliases: ["mittelerde", "middle earth", "herr der ringe", "lord of the rings", "der hobbit", "tolkien"],
    category: "film",
    titleRefs: middleEarthStory.map((item) => `${item.mediaType}:${item.tmdbId}`),
    backdropPath: MIDDLE_EARTH_IMAGE,
    posterPath: "/k6lw7hhaMDzJ170bfZfBbnipxcW.jpg",
    accent: "#53a06d",
    updatedAt: "September 2026",
    detailLevel: "catalog",
    modes: [
      { id: "story", label: "Chronologisch", description: "Zuerst die Hobbit-Trilogie, danach die Herr-der-Ringe-Trilogie.", entries: middleEarthStory },
      { id: "release", label: "Veröffentlichung", description: "Zuerst die Herr-der-Ringe-Trilogie, danach die später produzierte Hobbit-Trilogie.", entries: middleEarthRelease },
    ],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summary(definition: WatchOrderDefinition): WatchOrderSummary {
  return {
    id: definition.id,
    title: definition.title,
    eyebrow: definition.eyebrow,
    description: definition.description,
    aliases: definition.aliases,
    category: definition.category,
    titleRefs: definition.titleRefs,
    backdropPath: definition.backdropPath,
    posterPath: definition.posterPath,
    accent: definition.accent,
    entryCount: definition.modes.find((mode) => mode.id === "story")?.entries.length ?? definition.modes[0]?.entries.length ?? 0,
    updatedAt: definition.updatedAt,
    origin: "curated",
    confidence: "high",
    sourceLabel: "Manuell geprüft",
  };
}

export function listWatchOrders(query = "") {
  const needle = normalize(query);
  const definitions = needle
    ? WATCH_ORDER_DEFINITIONS.filter((definition) => {
        const haystacks = [definition.title, ...definition.aliases].map(normalize);
        const words = needle.split(" ").filter(Boolean);
        return haystacks.some((value) => value.includes(needle))
          || words.every((word) => haystacks.some((value) => value.includes(word)));
      })
    : WATCH_ORDER_DEFINITIONS;
  return definitions.map(summary);
}

export function findWatchOrderSummaryForTitle(title: Pick<Title, "id" | "mediaType" | "title" | "originalTitle">) {
  const ref = `${title.mediaType}:${title.id}`;
  const exact = WATCH_ORDER_DEFINITIONS.find((definition) => definition.titleRefs.includes(ref));
  if (exact) return summary(exact);
  const names = [title.title, title.originalTitle ?? ""].map(normalize);
  const loose = WATCH_ORDER_DEFINITIONS.find((definition) => (
    definition.aliases.map(normalize).some((alias) => alias.length >= 4 && names.some((name) => name.includes(alias)))
  ));
  return loose ? summary(loose) : null;
}

export async function getWatchOrder(id: string): Promise<WatchOrderDetails | null> {
  const definition = WATCH_ORDER_DEFINITIONS.find((item) => item.id === id);
  if (!definition) return null;

  const uniqueRefs = new Map<string, WatchOrderEntry>();
  definition.modes.flatMap((mode) => mode.entries).forEach((item) => {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!uniqueRefs.has(key)) uniqueRefs.set(key, item);
  });
  const resolved = new Map<string, Title | null>();
  const requests = [...uniqueRefs.entries()];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(6, requests.length) }, async () => {
    while (cursor < requests.length) {
      const [key, item] = requests[cursor++];
      const media = definition.detailLevel === "catalog"
        ? await watchOrderTitleDetails(item.mediaType, item.tmdbId)
        : await titleDetails(item.mediaType, item.tmdbId);
      resolved.set(key, media ? { ...media, episodeGuide: undefined } : null);
    }
  });
  await Promise.all(workers);

  const visualEntries = [...new Map(
    definition.modes.flatMap((mode) => mode.entries).map((item) => [item.id, item]),
  ).values()].filter((item) => item.mediaType === "tv");
  const entryImages = new Map<string, string>();
  await Promise.all(visualEntries.map(async (item, index) => {
    const seasonFromLabel = Number(item.seasonLabel?.match(/staffel\s*(\d+)/i)?.[1]);
    const episodeFromRange = Number(item.episodeRange?.match(/\d+/)?.[0]);
    const image = await watchOrderEntryImage(item.mediaType, item.tmdbId, {
      seasonNumber: item.seasonNumber ?? (Number.isFinite(seasonFromLabel) ? seasonFromLabel : undefined),
      episodeNumber: item.imageEpisodeNumber ?? (Number.isFinite(episodeFromRange) ? episodeFromRange : undefined),
      variant: index,
    });
    if (image) entryImages.set(item.id, image);
  }));

  return {
    ...summary(definition),
    modes: definition.modes.map((mode) => ({
      ...mode,
      entries: mode.entries.map((item) => ({
        ...item,
        media: (() => {
          const media = resolved.get(`${item.mediaType}:${item.tmdbId}`) ?? null;
          if (!media) return null;
          const individualImage = entryImages.get(item.id);
          if (individualImage) return { ...media, backdropPath: individualImage };
          if (item.imagePath && definition.detailLevel !== "catalog" && item.mediaType !== "movie") {
            return { ...media, backdropPath: item.imagePath };
          }
          return media;
        })(),
      })),
    })),
  };
}
