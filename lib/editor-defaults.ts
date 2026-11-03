import type { AnalyzeRequest } from "./edit-plan";
export const DEMO_TRANSCRIPT = `00:00 Willkommen zurück auf dem Kanal.
00:38 Heute schauen wir uns diesen völlig verrückten Audi A2 an.
01:12 Beim ersten Start klingt alles noch ganz normal.
01:46 Dann öffnen wir die Motorhaube und sehen den Umbau.
02:25 Niemand erwartet, was hier eingebaut wurde.
03:18 Der Motor startet sofort und die erste Reaktion sagt alles.
04:07 Jetzt zeigen wir den kompletten Motorraum.
05:26 Dieses kleine Detail macht den ganzen Umbau besonders.
06:22 Bei der Probefahrt taucht plötzlich ein Problem auf.
07:14 Wir finden die Ursache und ändern den Plan.
08:41 Nach dem Fix läuft das Auto endlich sauber.
09:36 Das Ergebnis ist besser als erwartet.`;
export const DEFAULT_REQUEST: AnalyzeRequest = {
  originalTitle: "",
  transcript: DEMO_TRANSCRIPT,
  instruction: "",
  provider: "mock",
};
