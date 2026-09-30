// Ausgewählte kostenlose Bücher (Links geprüft am 30.09.2026)
// level: 1 = leicht, 2 = mittel, 3 = schwer

const SE = (path, file) => `https://standardebooks.org/ebooks/${path}/downloads/${file}.epub?source=download`;

// Standard Ebooks (schön gesetzte EPUBs, Englisch)
export const EN_BOOKS = [
  { title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', level: 1, url: SE('lewis-carroll/alices-adventures-in-wonderland/john-tenniel', 'lewis-carroll_alices-adventures-in-wonderland') },
  { title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', level: 1, url: SE('l-frank-baum/the-wonderful-wizard-of-oz', 'l-frank-baum_the-wonderful-wizard-of-oz') },
  { title: 'The Secret Garden', author: 'Frances Hodgson Burnett', level: 1, url: SE('frances-hodgson-burnett/the-secret-garden', 'frances-hodgson-burnett_the-secret-garden') },
  { title: 'The Call of the Wild', author: 'Jack London', level: 2, url: SE('jack-london/the-call-of-the-wild', 'jack-london_the-call-of-the-wild') },
  { title: 'The Jungle Book', author: 'Rudyard Kipling', level: 2, url: SE('rudyard-kipling/the-jungle-book', 'rudyard-kipling_the-jungle-book') },
  { title: 'The Wind in the Willows', author: 'Kenneth Grahame', level: 2, url: SE('kenneth-grahame/the-wind-in-the-willows', 'kenneth-grahame_the-wind-in-the-willows') },
  { title: 'Treasure Island', author: 'Robert Louis Stevenson', level: 2, url: SE('robert-louis-stevenson/treasure-island', 'robert-louis-stevenson_treasure-island') },
  { title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson', level: 2, url: SE('robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde', 'robert-louis-stevenson_the-strange-case-of-dr-jekyll-and-mr-hyde') },
  { title: 'The Time Machine', author: 'H. G. Wells', level: 2, url: SE('h-g-wells/the-time-machine', 'h-g-wells_the-time-machine') },
  { title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', level: 2, url: SE('arthur-conan-doyle/the-adventures-of-sherlock-holmes', 'arthur-conan-doyle_the-adventures-of-sherlock-holmes') },
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', level: 2, url: SE('arthur-conan-doyle/the-hound-of-the-baskervilles', 'arthur-conan-doyle_the-hound-of-the-baskervilles') },
  { title: 'The Mysterious Affair at Styles', author: 'Agatha Christie', level: 2, url: SE('agatha-christie/the-mysterious-affair-at-styles', 'agatha-christie_the-mysterious-affair-at-styles') },
  { title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', level: 2, url: SE('mark-twain/the-adventures-of-tom-sawyer', 'mark-twain_the-adventures-of-tom-sawyer') },
  { title: 'A Christmas Carol', author: 'Charles Dickens', level: 2, url: SE('charles-dickens/a-christmas-carol', 'charles-dickens_a-christmas-carol') },
  { title: 'The Sun Also Rises', author: 'Ernest Hemingway', level: 2, url: SE('ernest-hemingway/the-sun-also-rises', 'ernest-hemingway_the-sun-also-rises') },
  { title: 'Three Men in a Boat', author: 'Jerome K. Jerome', level: 2, url: SE('jerome-k-jerome/three-men-in-a-boat', 'jerome-k-jerome_three-men-in-a-boat') },
  { title: 'Around the World in Eighty Days', author: 'Jules Verne', level: 2, url: SE('jules-verne/around-the-world-in-eighty-days/george-makepeace-towle', 'jules-verne_around-the-world-in-eighty-days') },
  { title: 'Short Stories', author: 'O. Henry', level: 2, url: SE('o-henry/short-fiction', 'o-henry_short-fiction') },
  { title: 'Short Stories', author: 'Anton Chekhov', level: 2, url: SE('anton-chekhov/short-fiction/constance-garnett', 'anton-chekhov_short-fiction') },
  { title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', level: 3, url: SE('oscar-wilde/the-picture-of-dorian-gray', 'oscar-wilde_the-picture-of-dorian-gray') },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', level: 3, url: SE('f-scott-fitzgerald/the-great-gatsby', 'f-scott-fitzgerald_the-great-gatsby') },
  { title: 'Pride and Prejudice', author: 'Jane Austen', level: 3, url: SE('jane-austen/pride-and-prejudice', 'jane-austen_pride-and-prejudice') },
  { title: 'Frankenstein', author: 'Mary Shelley', level: 3, url: SE('mary-shelley/frankenstein', 'mary-shelley_frankenstein') },
  { title: 'Dracula', author: 'Bram Stoker', level: 3, url: SE('bram-stoker/dracula', 'bram-stoker_dracula') },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', level: 3, url: SE('charlotte-bronte/jane-eyre', 'charlotte-bronte_jane-eyre') },
  { title: 'Gulliver’s Travels', author: 'Jonathan Swift', level: 3, url: SE('jonathan-swift/gullivers-travels', 'jonathan-swift_gullivers-travels') },
  { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', level: 3, url: SE('fyodor-dostoevsky/crime-and-punishment/constance-garnett', 'fyodor-dostoevsky_crime-and-punishment') },
  { title: 'Short Stories', author: 'Edgar Allan Poe', level: 3, url: SE('edgar-allan-poe/short-fiction', 'edgar-allan-poe_short-fiction') },
];

// Project Gutenberg über archive.org (Text-Dateien, Deutsch)
export const DE_BOOKS = [
  { title: 'Max und Moritz', author: 'Wilhelm Busch', level: 1, ia: 'maxundmoritz17161gut', file: '17161-8.txt' },
  { title: 'Der Struwwelpeter', author: 'Heinrich Hoffmann', level: 1, ia: 'derstruwwelpeter24571gut', file: '24571-0.txt' },
  { title: 'Die Verwandlung', author: 'Franz Kafka', level: 2, ia: 'dieverwandlung22367gut', file: '22367-8.txt' },
  { title: 'Das Urteil', author: 'Franz Kafka', level: 2, ia: 'dasurteileineges21593gut', file: '21593-0.txt' },
  { title: 'Knulp', author: 'Hermann Hesse', level: 2, ia: 'knulp17622gut', file: '17622-0.txt' },
  { title: 'Tonio Kröger', author: 'Thomas Mann', level: 2, ia: 'toniokrger23313gut', file: '23313-8.txt' },
  { title: 'Im Sonnenschein', author: 'Theodor Storm', level: 2, ia: 'imsonnenscheinno20977gut', file: '20977-0.txt' },
  { title: 'Unterm Birnbaum', author: 'Theodor Fontane', level: 2, ia: 'untermbirnbaum26686gut', file: '26686-0.txt' },
  { title: 'Aus dem Leben eines Taugenichts', author: 'Joseph von Eichendorff', level: 2, ia: 'ausdemlebeneines35312gut', file: '35312-8.txt' },
  { title: 'In der Strafkolonie', author: 'Franz Kafka', level: 3, ia: 'inderstrafkoloni25791gut', file: '25791-0.txt' },
  { title: 'Der Tod in Venedig', author: 'Thomas Mann', level: 3, ia: 'dertodinvenedig12108gut', file: '12108-8.txt' },
  { title: 'Buddenbrooks', author: 'Thomas Mann', level: 3, ia: 'buddenbrooksverf34811gut', file: '34811-8.txt' },
  { title: 'Faust. Eine Tragödie', author: 'Johann Wolfgang von Goethe', level: 3, ia: 'fausteinetragdie21000gut', file: '21000-0.txt' },
];

// Sprachen für die Suche (archive.org-Kennungen)
export const SEARCH_LANGS = {
  en: '(eng OR english)',
  de: '(ger OR german OR deu)',
  ru: '(rus OR russian)',
  fr: '(fre OR french OR fra)',
  es: '(spa OR spanish)',
  it: '(ita OR italian)',
  nl: '(dut OR dutch OR nld)',
  pt: '(por OR portuguese)',
};

// LibriVox-Hörbücher auf archive.org (Sprachcodes geprüft)
export const LIBRIVOX_LANGS = {
  en: '(eng)', de: '(deu OR ger)', ru: '(rus)', fr: '(fre OR fra)', es: '(spa)', it: '(ita)', nl: '(dut OR nld)', pt: '(por)',
};
