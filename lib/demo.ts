import { PROVIDERS } from "./providers";
import type { MediaType, Title } from "./types";

const names = [
  ["Avatar: Der Herr der Elemente", "tv", [337, 8], [16, 10751], false],
  ["Die Festnahme", "movie", [8], [80, 53], false],
  ["Der Astronaut – Project Hail Mary", "movie", [119, 350], [878, 12], false],
  ["The Rookie", "tv", [8, 337], [80, 18], false],
  ["The Mentalist", "tv", [8, 119], [80, 18], false],
  ["Supernatural", "tv", [119], [18, 14], false],
  ["Criminal Minds", "tv", [337, 531], [80, 18], false],
  ["Avengers: Infinity War", "movie", [337], [28, 878], false],
  ["Lioness", "tv", [531, 119], [18, 53], false],
  ["Reacher", "tv", [119], [28, 80], false],
  ["Marvel's The Avengers", "movie", [337], [28, 878], false],
  ["Die Simpsons", "tv", [337], [16, 35], false],
  ["Law & Order: Special Victims Unit", "tv", [8, 119], [80, 18], false],
  ["Navy CIS", "tv", [531, 119], [80, 18], false],
  ["The Mandalorian", "tv", [337], [878, 12], false],
  ["Family Guy", "tv", [337], [16, 35], false],
  ["The Last Sunrise", "movie", [119], [18, 10749], false],
  ["Der Kinderflüsterer", "movie", [8], [53, 27], false],
  ["Cyberpunk: Edgerunners", "tv", [8], [16, 878], true],
  ["Frieren", "tv", [283], [16, 14], true],
  ["Jujutsu Kaisen", "tv", [283, 8], [16, 28], true],
  ["Demon Slayer", "tv", [283, 8], [16, 28], true],
  ["Silo", "tv", [350], [878, 18], false],
  ["Severance", "tv", [350], [878, 18], false],
  ["Andor", "tv", [337], [878, 18], false],
  ["The Bear", "tv", [337], [18, 35], false],
  ["Fallout", "tv", [119], [878, 28], false],
  ["Arcane", "tv", [8], [16, 14], true],
  ["Knives Out", "movie", [8, 119], [80, 35], false],
  ["Dune", "movie", [8, 119], [878, 12], false],
] as const;

const palettes = [
  "linear-gradient(155deg,#153750 0%,#0d1727 55%,#080a10 100%)",
  "linear-gradient(155deg,#4b172a 0%,#1d111c 54%,#090a10 100%)",
  "linear-gradient(155deg,#4a3012 0%,#21160e 55%,#08090e 100%)",
  "linear-gradient(155deg,#1c3159 0%,#12182b 55%,#08090e 100%)",
  "linear-gradient(155deg,#31363d 0%,#15191f 55%,#08090e 100%)",
];

export function demoTitles(): Title[] {
  return names.map(([title, mediaType, providerIds, genreIds, anime], index) => ({
    id: 100000 + index,
    mediaType: mediaType as MediaType,
    title,
    originalTitle: title,
    overview: `${title} ist ein Demo-Titel. Hinterlege deinen TMDB API Read Access Token, um echte Beschreibungen, Poster und Verfügbarkeiten für Deutschland zu laden.`,
    year: String(2005 + (index % 21)),
    rating: Number((9.1 - (index % 16) * 0.13).toFixed(1)),
    popularity: 100 - index,
    genreIds: [...genreIds],
    genres: genreIds.map((id) => ({ id, name: "Genre" })),
    posterPath: null,
    backdropPath: null,
    providers: providerIds.map((id) => PROVIDERS.find((provider) => provider.id === id)!).filter(Boolean),
    anime,
    runtime: mediaType === "movie" ? 120 + (index % 25) : null,
    seasons: mediaType === "tv" ? 1 + (index % 8) : null,
    watchLink: palettes[index % palettes.length],
  }));
}
