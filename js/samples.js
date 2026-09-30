// Gemeinfreie Beispieltexte zum Ausprobieren
const p = (s) => s.trim().split(/\n\s*\n/).map((x) => `<p>${x.trim().replace(/\s*\n\s*/g, ' ')}</p>`).join('\n');

export const SAMPLES = [
  {
    key: 'alice',
    title: 'Alice’s Adventures in Wonderland',
    author: 'Lewis Carroll',
    lang: 'en',
    chapters: [
      {
        title: 'Chapter I. Down the Rabbit-Hole',
        html: '<h2>Chapter I.<br>Down the Rabbit-Hole</h2>' + p(`
Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.

In another moment down went Alice after it, never once considering how in the world she was to get out again.

The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.

Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.

“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs! How brave they’ll all think me at home! Why, I wouldn’t say anything about it, even if I fell off the top of the house!” (Which was very likely true.)

Down, down, down. Would the fall never come to an end? “I wonder how many miles I’ve fallen by this time?” she said aloud. “I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—” (for, you see, Alice had learnt several things of this sort in her lessons in the schoolroom, and though this was not a very good opportunity for showing off her knowledge, as there was no one to listen to her, still it was good practice to say it over) “—yes, that’s about the right distance—but then I wonder what Latitude or Longitude I’ve got to?” (Alice had no idea what Latitude was, or Longitude either, but thought they were nice grand words to say.)

Presently she began again. “I wonder if I shall fall right through the earth! How funny it’ll seem to come out among the people that walk with their heads downward! The Antipathies, I think—” (she was rather glad there was no one listening, this time, as it didn’t sound at all the right word) “—but I shall have to ask them what the name of the country is, you know. Please, Ma’am, is this New Zealand or Australia?” (and she tried to curtsey as she spoke—fancy curtseying as you’re falling through the air! Do you think you could manage it?) “And what an ignorant little girl she’ll think me for asking! No, it’ll never do to ask: perhaps I shall see it written up somewhere.”

Down, down, down. There was nothing else to do, so Alice soon began talking again. “Dinah’ll miss me very much to-night, I should think!” (Dinah was the cat.) “I hope they’ll remember her saucer of milk at tea-time. Dinah my dear! I wish you were down here with me! There are no mice in the air, I’m afraid, but you might catch a bat, and that’s very like a mouse, you know. But do cats eat bats, I wonder?” And here Alice began to get rather sleepy, and went on saying to herself, in a dreamy sort of way, “Do cats eat bats? Do cats eat bats?” and sometimes, “Do bats eat cats?” for, you see, as she couldn’t answer either question, it didn’t much matter which way she put it.

She felt that she was dozing off, and had just begun to dream that she was walking hand in hand with Dinah, and saying to her very earnestly, “Now, Dinah, tell me the truth: did you ever eat a bat?” when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over.
`),
      },
    ],
  },
  {
    key: 'bremen',
    title: 'Die Bremer Stadtmusikanten',
    author: 'Brüder Grimm',
    lang: 'de',
    chapters: [
      {
        title: 'Die Bremer Stadtmusikanten',
        html: '<h2>Die Bremer Stadtmusikanten</h2>' + p(`
Es hatte ein Mann einen Esel, der schon lange Jahre die Säcke unverdrossen zur Mühle getragen hatte, dessen Kräfte aber nun zu Ende gingen, sodass er zur Arbeit immer untauglicher wurde. Da dachte der Herr daran, ihn aus dem Futter zu schaffen. Aber der Esel merkte, dass kein guter Wind wehte, lief fort und machte sich auf den Weg nach Bremen; dort, meinte er, könnte er ja Stadtmusikant werden.

Als er ein Weilchen fortgegangen war, fand er einen Jagdhund auf dem Wege liegen, der japste wie einer, der sich müde gelaufen hat. „Nun, was japst du so, Packan?“, fragte der Esel. „Ach“, sagte der Hund, „weil ich alt bin und jeden Tag schwächer werde und auf der Jagd nicht mehr fort kann, hat mich mein Herr totschlagen wollen. Da habe ich Reißaus genommen; aber womit soll ich nun mein Brot verdienen?“ – „Weißt du was“, sprach der Esel, „ich gehe nach Bremen und werde dort Stadtmusikant. Geh mit und lass dich auch bei der Musik annehmen. Ich spiele die Laute, und du schlägst die Pauken.“ Der Hund war zufrieden, und sie gingen weiter.

Es dauerte nicht lange, da saß eine Katze am Weg und machte ein Gesicht wie drei Tage Regenwetter. „Nun, was ist dir in die Quere gekommen, alter Bartputzer?“, sprach der Esel. „Wer kann da lustig sein, wenn’s einem an den Kragen geht“, antwortete die Katze. „Weil ich nun zu Jahren komme, meine Zähne stumpf werden und ich lieber hinter dem Ofen sitze und spinne, als nach Mäusen herumzujagen, hat mich meine Frau ersäufen wollen. Ich habe mich zwar noch davongemacht, aber nun ist guter Rat teuer: Wo soll ich hin?“ – „Geh mit uns nach Bremen! Du verstehst dich doch auf die Nachtmusik, da kannst du ein Stadtmusikant werden.“ Die Katze hielt das für gut und ging mit.

Darauf kamen die drei Landesflüchtigen an einem Hof vorbei. Da saß auf dem Tor der Haushahn und schrie aus Leibeskräften. „Du schreist einem durch Mark und Bein“, sprach der Esel, „was hast du vor?“ – „Morgen zum Sonntag kommen Gäste“, sprach der Hahn, „da hat die Hausfrau kein Erbarmen und hat der Köchin gesagt, sie wolle mich morgen in der Suppe essen, und heute Abend soll mir der Kopf abgeschnitten werden. Nun schrei ich aus vollem Hals, solange ich noch kann.“ – „Ei was, du Rotkopf“, sagte der Esel, „zieh lieber mit uns fort, wir gehen nach Bremen. Etwas Besseres als den Tod findest du überall. Du hast eine gute Stimme, und wenn wir zusammen musizieren, so muss es eine Art haben.“ Der Hahn ließ sich den Vorschlag gefallen, und sie gingen alle vier zusammen fort.

Sie konnten aber die Stadt Bremen an einem Tag nicht erreichen und kamen abends in einen Wald, wo sie übernachten wollten. Der Esel und der Hund legten sich unter einen großen Baum, die Katze und der Hahn machten sich in die Äste, der Hahn aber flog bis in die Spitze, wo es am sichersten für ihn war. Ehe er einschlief, sah er sich noch einmal nach allen vier Winden um. Da meinte er, in der Ferne ein Fünkchen brennen zu sehen, und rief seinen Gesellen zu, es müsse nicht weit ein Haus sein, denn es scheine ein Licht. Der Esel sprach: „So müssen wir uns aufmachen und noch hingehen, denn hier ist die Herberge schlecht.“ Der Hund meinte, ein paar Knochen und etwas Fleisch daran täten ihm auch gut.

Also machten sie sich auf den Weg zu der Gegend, wo das Licht war, und sahen es bald heller schimmern, und es wurde immer größer, bis sie vor ein hell erleuchtetes Räuberhaus kamen. Der Esel, als der größte, näherte sich dem Fenster und schaute hinein. „Was siehst du, Grauschimmel?“, fragte der Hahn. „Was ich sehe?“, antwortete der Esel. „Einen gedeckten Tisch mit schönem Essen und Trinken, und Räuber sitzen daran und lassen es sich gut gehen.“ – „Das wäre was für uns“, sprach der Hahn.

Da berieten die Tiere, wie sie es anfangen müssten, um die Räuber hinauszujagen, und fanden endlich ein Mittel. Der Esel stellte sich mit den Vorderfüßen auf das Fenster, der Hund sprang auf den Rücken des Esels, die Katze kletterte auf den Hund, und zuletzt flog der Hahn hinauf und setzte sich der Katze auf den Kopf. Auf ein Zeichen fingen sie alle zusammen an, ihre Musik zu machen: Der Esel schrie, der Hund bellte, die Katze miaute, und der Hahn krähte. Dann stürzten sie durch das Fenster in die Stube hinein, dass die Scheiben klirrten.

Die Räuber fuhren bei dem entsetzlichen Geschrei in die Höhe. Sie meinten nicht anders, als dass ein Gespenst hereinkäme, und flohen in größter Furcht in den Wald hinaus. Nun setzten sich die vier Gesellen an den Tisch, nahmen mit dem vorlieb, was übrig geblieben war, und aßen, als wenn sie vier Wochen hungern sollten.

Den vier Bremer Musikanten gefiel es aber so gut in dem Haus, dass sie nicht wieder hinaus wollten. Und der das zuletzt erzählt hat, dem ist der Mund noch warm.
`),
      },
    ],
  },
];
