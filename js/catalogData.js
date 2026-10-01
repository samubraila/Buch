// Ausgewählte kostenlose Bücher für "Entdecken" (Links geprüft am 01.10.2026)
// level: 1 = leicht, 2 = mittel, 3 = schwer
//
// Beim Bauen auf GitHub (tools/fetch-books.mjs) werden alle Bücher heruntergeladen und unter
// books/<id>.epub mitveröffentlicht. Die App lädt zuerst von dort (eigener Server, funktioniert
// überall) und nur notfalls direkt von der Original-Seite ("remote").

const SE = (path, file) => `https://standardebooks.org/ebooks/${path}/downloads/${file}.epub?source=download`;
const IA = (item, file) => `https://archive.org/download/${item}/${file}`;

/** @typedef {{ id: string, title: string, author: string, lang: string, level: number, source: string,
 *   remote?: string, remoteName?: string, gutenberg?: number, se?: string }} CatalogBook */

/** @type {CatalogBook[]} */
export const EN_BOOKS = [
  // --- Leicht ---
  { id: 'pg-14838', gutenberg: 14838, title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', level: 1 },
  { id: 'pg-11757', gutenberg: 11757, title: 'The Velveteen Rabbit', author: 'Margery Williams', level: 1 },
  { id: 'pg-21', gutenberg: 21, title: 'Aesop’s Fables', author: 'Aesop', level: 1 },
  { id: 'pg-2591', gutenberg: 2591, title: 'Grimms’ Fairy Tales', author: 'Brothers Grimm', level: 1 },
  { id: 'pg-1597', gutenberg: 1597, title: 'Andersen’s Fairy Tales', author: 'Hans Christian Andersen', level: 1 },
  { id: 'se-alice', se: SE('lewis-carroll/alices-adventures-in-wonderland/john-tenniel', 'lewis-carroll_alices-adventures-in-wonderland'), title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', level: 1 },
  { id: 'se-oz', se: SE('l-frank-baum/the-wonderful-wizard-of-oz', 'l-frank-baum_the-wonderful-wizard-of-oz'), title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', level: 1 },
  { id: 'se-secret-garden', se: SE('frances-hodgson-burnett/the-secret-garden', 'frances-hodgson-burnett_the-secret-garden'), title: 'The Secret Garden', author: 'Frances Hodgson Burnett', level: 1 },
  { id: 'pg-501', gutenberg: 501, title: 'The Story of Doctor Dolittle', author: 'Hugh Lofting', level: 1 },
  { id: 'pg-500', gutenberg: 500, title: 'The Adventures of Pinocchio', author: 'Carlo Collodi', level: 1 },
  { id: 'pg-1874', gutenberg: 1874, title: 'The Railway Children', author: 'E. Nesbit', level: 1 },
  { id: 'pg-1448', gutenberg: 1448, title: 'Heidi', author: 'Johanna Spyri', level: 1 },
  { id: 'pg-16', gutenberg: 16, title: 'Peter Pan', author: 'J. M. Barrie', level: 1 },
  // --- Mittel ---
  { id: 'pg-271', gutenberg: 271, title: 'Black Beauty', author: 'Anna Sewell', level: 2 },
  { id: 'pg-45', gutenberg: 45, title: 'Anne of Green Gables', author: 'L. M. Montgomery', level: 2 },
  { id: 'se-call-wild', se: SE('jack-london/the-call-of-the-wild', 'jack-london_the-call-of-the-wild'), title: 'The Call of the Wild', author: 'Jack London', level: 2 },
  { id: 'se-jungle-book', se: SE('rudyard-kipling/the-jungle-book', 'rudyard-kipling_the-jungle-book'), title: 'The Jungle Book', author: 'Rudyard Kipling', level: 2 },
  { id: 'se-willows', se: SE('kenneth-grahame/the-wind-in-the-willows', 'kenneth-grahame_the-wind-in-the-willows'), title: 'The Wind in the Willows', author: 'Kenneth Grahame', level: 2 },
  { id: 'se-treasure-island', se: SE('robert-louis-stevenson/treasure-island', 'robert-louis-stevenson_treasure-island'), title: 'Treasure Island', author: 'Robert Louis Stevenson', level: 2 },
  { id: 'se-jekyll', se: SE('robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde', 'robert-louis-stevenson_the-strange-case-of-dr-jekyll-and-mr-hyde'), title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson', level: 2 },
  { id: 'se-time-machine', se: SE('h-g-wells/the-time-machine', 'h-g-wells_the-time-machine'), title: 'The Time Machine', author: 'H. G. Wells', level: 2 },
  { id: 'se-sherlock', se: SE('arthur-conan-doyle/the-adventures-of-sherlock-holmes', 'arthur-conan-doyle_the-adventures-of-sherlock-holmes'), title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', level: 2 },
  { id: 'se-baskervilles', se: SE('arthur-conan-doyle/the-hound-of-the-baskervilles', 'arthur-conan-doyle_the-hound-of-the-baskervilles'), title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', level: 2 },
  { id: 'se-styles', se: SE('agatha-christie/the-mysterious-affair-at-styles', 'agatha-christie_the-mysterious-affair-at-styles'), title: 'The Mysterious Affair at Styles', author: 'Agatha Christie', level: 2 },
  { id: 'se-tom-sawyer', se: SE('mark-twain/the-adventures-of-tom-sawyer', 'mark-twain_the-adventures-of-tom-sawyer'), title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', level: 2 },
  { id: 'se-christmas-carol', se: SE('charles-dickens/a-christmas-carol', 'charles-dickens_a-christmas-carol'), title: 'A Christmas Carol', author: 'Charles Dickens', level: 2 },
  { id: 'se-sun-also-rises', se: SE('ernest-hemingway/the-sun-also-rises', 'ernest-hemingway_the-sun-also-rises'), title: 'The Sun Also Rises', author: 'Ernest Hemingway', level: 2 },
  { id: 'se-three-men', se: SE('jerome-k-jerome/three-men-in-a-boat', 'jerome-k-jerome_three-men-in-a-boat'), title: 'Three Men in a Boat', author: 'Jerome K. Jerome', level: 2 },
  { id: 'se-eighty-days', se: SE('jules-verne/around-the-world-in-eighty-days/george-makepeace-towle', 'jules-verne_around-the-world-in-eighty-days'), title: 'Around the World in Eighty Days', author: 'Jules Verne', level: 2 },
  { id: 'se-o-henry', se: SE('o-henry/short-fiction', 'o-henry_short-fiction'), title: 'Short Stories', author: 'O. Henry', level: 2 },
  { id: 'se-chekhov', se: SE('anton-chekhov/short-fiction/constance-garnett', 'anton-chekhov_short-fiction'), title: 'Short Stories', author: 'Anton Chekhov', level: 2 },
  // --- Schwer ---
  { id: 'se-dorian-gray', se: SE('oscar-wilde/the-picture-of-dorian-gray', 'oscar-wilde_the-picture-of-dorian-gray'), title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', level: 3 },
  { id: 'se-gatsby', se: SE('f-scott-fitzgerald/the-great-gatsby', 'f-scott-fitzgerald_the-great-gatsby'), title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', level: 3 },
  { id: 'se-pride', se: SE('jane-austen/pride-and-prejudice', 'jane-austen_pride-and-prejudice'), title: 'Pride and Prejudice', author: 'Jane Austen', level: 3 },
  { id: 'se-frankenstein', se: SE('mary-shelley/frankenstein', 'mary-shelley_frankenstein'), title: 'Frankenstein', author: 'Mary Shelley', level: 3 },
  { id: 'se-dracula', se: SE('bram-stoker/dracula', 'bram-stoker_dracula'), title: 'Dracula', author: 'Bram Stoker', level: 3 },
  { id: 'se-jane-eyre', se: SE('charlotte-bronte/jane-eyre', 'charlotte-bronte_jane-eyre'), title: 'Jane Eyre', author: 'Charlotte Brontë', level: 3 },
  { id: 'se-gulliver', se: SE('jonathan-swift/gullivers-travels', 'jonathan-swift_gullivers-travels'), title: 'Gulliver’s Travels', author: 'Jonathan Swift', level: 3 },
  { id: 'se-crime-punishment', se: SE('fyodor-dostoevsky/crime-and-punishment/constance-garnett', 'fyodor-dostoevsky_crime-and-punishment'), title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', level: 3 },
  { id: 'se-poe', se: SE('edgar-allan-poe/short-fiction', 'edgar-allan-poe_short-fiction'), title: 'Short Stories', author: 'Edgar Allan Poe', level: 3 },
].map((b) => ({ lang: 'en', source: b.se ? 'Standard Ebooks' : 'Gutenberg', remote: b.se, remoteName: b.se ? `${b.id}.epub` : undefined, ...b }));

/** @type {CatalogBook[]} */
export const DE_BOOKS = [
  // --- Leicht ---
  { id: 'pg-17161', gutenberg: 17161, title: 'Max und Moritz', author: 'Wilhelm Busch', level: 1, remote: IA('maxundmoritz17161gut', '17161-8.txt') },
  { id: 'pg-24571', gutenberg: 24571, title: 'Der Struwwelpeter', author: 'Heinrich Hoffmann', level: 1, remote: IA('derstruwwelpeter24571gut', '24571-0.txt') },
  { id: 'pg-7511', gutenberg: 7511, title: 'Heidis Lehr- und Wanderjahre', author: 'Johanna Spyri', level: 1 },
  // --- Mittel ---
  { id: 'pg-22367', gutenberg: 22367, title: 'Die Verwandlung', author: 'Franz Kafka', level: 2, remote: IA('dieverwandlung22367gut', '22367-8.txt') },
  { id: 'pg-21593', gutenberg: 21593, title: 'Das Urteil', author: 'Franz Kafka', level: 2, remote: IA('dasurteileineges21593gut', '21593-0.txt') },
  { id: 'pg-17622', gutenberg: 17622, title: 'Knulp', author: 'Hermann Hesse', level: 2, remote: IA('knulp17622gut', '17622-0.txt') },
  { id: 'pg-2499', gutenberg: 2499, title: 'Siddhartha', author: 'Hermann Hesse', level: 2 },
  { id: 'pg-23313', gutenberg: 23313, title: 'Tonio Kröger', author: 'Thomas Mann', level: 2, remote: IA('toniokrger23313gut', '23313-8.txt') },
  { id: 'pg-20977', gutenberg: 20977, title: 'Im Sonnenschein', author: 'Theodor Storm', level: 2, remote: IA('imsonnenscheinno20977gut', '20977-0.txt') },
  { id: 'pg-26686', gutenberg: 26686, title: 'Unterm Birnbaum', author: 'Theodor Fontane', level: 2, remote: IA('untermbirnbaum26686gut', '26686-0.txt') },
  { id: 'pg-35312', gutenberg: 35312, title: 'Aus dem Leben eines Taugenichts', author: 'Joseph von Eichendorff', level: 2, remote: IA('ausdemlebeneines35312gut', '35312-8.txt') },
  // --- Schwer ---
  { id: 'pg-25791', gutenberg: 25791, title: 'In der Strafkolonie', author: 'Franz Kafka', level: 3, remote: IA('inderstrafkoloni25791gut', '25791-0.txt') },
  { id: 'pg-12108', gutenberg: 12108, title: 'Der Tod in Venedig', author: 'Thomas Mann', level: 3, remote: IA('dertodinvenedig12108gut', '12108-8.txt') },
  { id: 'pg-5323', gutenberg: 5323, title: 'Effi Briest', author: 'Theodor Fontane', level: 3 },
  { id: 'pg-34811', gutenberg: 34811, title: 'Buddenbrooks', author: 'Thomas Mann', level: 3, remote: IA('buddenbrooksverf34811gut', '34811-8.txt') },
  { id: 'pg-21000', gutenberg: 21000, title: 'Faust. Eine Tragödie', author: 'Johann Wolfgang von Goethe', level: 3, remote: IA('fausteinetragdie21000gut', '21000-0.txt') },
].map((b) => ({ lang: 'de', source: 'Gutenberg', remoteName: b.remote ? b.remote.split('/').pop() : undefined, ...b }));

export const ALL_BOOKS = [...EN_BOOKS, ...DE_BOOKS];

/** Wo der Build-Server das Buch herunterlädt (mehrere Möglichkeiten, in dieser Reihenfolge) */
export function buildSources(b) {
  if (b.se) return [b.se];
  if (b.gutenberg) {
    const g = `https://www.gutenberg.org/ebooks/${b.gutenberg}`;
    return [`${g}.epub3.images`, `${g}.epub.images`, `${g}.epub.noimages`];
  }
  return [];
}

// Sprachen für die Suche (archive.org-Kennungen)
export const SEARCH_LANGS = {
  en: '(eng OR english)',
  de: '(ger OR german OR deu)',
  ru: '(rus OR russian)',
  fr: '(fre OR french OR fra)',
  es: '(spa OR spanish)',
  it: '(ita OR italian)',
  nl: '(dut OR nld OR dutch)',
  pt: '(por OR portuguese)',
};

// LibriVox-Hörbücher auf archive.org (Sprachcodes geprüft)
export const LIBRIVOX_LANGS = {
  en: '(eng)', de: '(deu OR ger)', ru: '(rus)', fr: '(fre OR fra)', es: '(spa)', it: '(ita)', nl: '(dut OR nld)', pt: '(por)',
};
