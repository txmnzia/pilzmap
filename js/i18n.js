// UI strings in English, German and French. Pure module (no DOM), tested for key parity.
// Species names and notes live in data/species.json (name/notes per language).

export const LANGS = ["en", "de", "fr"];

// Choose the language: explicit (URL or saved) first, then the browser, else English.
export function pickLang(explicit, browserLangs = []) {
  if (LANGS.includes(explicit)) return explicit;
  for (const l of browserLangs) {
    const short = String(l).slice(0, 2).toLowerCase();
    if (LANGS.includes(short)) return short;
  }
  return "en";
}

export const T = {
  en: {
    colon: ": ",
    months: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    classes: ["none", "low", "medium", "high"],
    trees: ["Pine", "Spruce", "Douglas fir", "Larch", "Fir", "Beech", "Oak", "Birch", "Alder", "Other broadleaf", "Clearing or canopy loss"],
    noForest: "no forest",
    nutrient: ["unknown", "A poor", "A poor", "A/Z", "Z rather poor", "Z/M", "M medium", "M/K", "K rich", "K/R", "R very rich"],
    water: ["unknown", "dry", "moderately fresh", "weakly groundwater-fresh", "fresh", "very fresh", "damp", "wet", "swampy"],
    season: (a, b) => `Season ${a} to ${b}`,
    inSeason: "in season", outSeason: "out of season",
    protectedBadge: "Protected (BArtSchV): small amounts, own use only",
    unvalidated: (n) => `unvalidated (${n} records)`,
    quality: ["barely better than chance", "weak", "useful"],
    accuracy: (label, auc, n) => `Accuracy ${label} (AUC ${auc}, ${n} records)`,
    pop: { trees: "Trees", nutrients: "Nutrients", water: "Water", soil: "Soil", peat: "peat",
      protected: "Protected", natp: "National park", nsg: "Nature reserve", banned: "picking usually banned", noSite: "no site data" },
    legend: ["high", "medium", "low", "nature reserve"],
    close: "Close", infoLabel: "Method, data and legal", mapLabel: "Map", speciesLabel: "Species", langLabel: "Language",
    libFail: "The map library failed to load. Reload the page.",
    model: { calibrated: "calibrated", prior: "expert", untested: "expert, untested" },
    table: ["Species", "Records", "AUC expert", "AUC calibrated", "Used"],
    info: {
      what: ["What this map shows", "Where the <b>habitat</b> suits a species: host tree, soil nutrients and water regime. It does <b>not</b> show where mushrooms are right now. Fruiting depends on weather (rain, then warmth, 1 to 3 weeks later)."],
      method: ["Method", "Per 20 m cell: suitability = host tree × nutrient level × water regime. Tree species: DLR Tree Species Germany 2022 (Sentinel-1/2, 10 m). Soil: the official forest site surveys of Brandenburg (1:10 000) and Berlin. Where no site data exists (about 28 % of forest) a neutral factor is used."],
      valid: ["Calibration and validation (GBIF records)", "Expert tables were adjusted with about 27 000 fungi records from Berlin and Brandenburg (GBIF, mostly iNaturalist), shrunk toward the expert values by sample size. Ecological exclusions (e.g. porcini on waterlogged soil) stay fixed. Quality is measured out of sample (5-fold spatial cross-validation, 20 km blocks): can the map tell this species' finds from other fungi finds <i>inside forest</i>? AUC 0.5 = chance, 0.7 = useful. Calibration is only kept where it scores better."],
      honest: "Honest reading: the map mainly separates pine forest on poor sand from everything else. Inside that block (about half of all forest) it cannot rank further, because tree species and site class are the same there. Its value is ruling out unsuitable ground.",
      limits: ["Limits", "Only the dominant tree per cell is known, so birches mixed into pine stands are missing. Stand age, nitrogen pollution and weather are not modelled. Record positions are accurate to 200 m at best. Chanterelle is over-predicted. Land contaminated with old munitions is not publicly mapped: obey closure signs."],
      law: ["Law and safety", "Porcini, chanterelle, birch boletes and orange boletes are specially protected (BArtSchV): small amounts for your own use only, no selling. Picking is usually banned in nature reserves and the national park (hatched; check the local ordinance). Never eat a mushroom you cannot identify with certainty; ask a certified mushroom adviser (DGfM Pilzsachverständige). This map does not identify mushrooms."],
      excluded: "Deliberately left out:",
      data: "Data",
    },
  },
  de: {
    colon: ": ",
    months: ["", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
    classes: ["keine", "gering", "mittel", "hoch"],
    trees: ["Kiefer", "Fichte", "Douglasie", "Lärche", "Tanne", "Buche", "Eiche", "Birke", "Erle", "andere Laubbäume", "Kahlfläche oder Schaden"],
    noForest: "kein Wald",
    nutrient: ["unbekannt", "A arm", "A arm", "A/Z", "Z ziemlich arm", "Z/M", "M mittel", "M/K", "K kräftig", "K/R", "R reich"],
    water: ["unbekannt", "trocken", "mäßig frisch", "schwach grundfrisch", "frisch", "sehr frisch", "feucht", "nass", "sumpfig"],
    season: (a, b) => `Saison ${a} bis ${b}`,
    inSeason: "Saison", outSeason: "keine Saison",
    protectedBadge: "Geschützt (BArtSchV): nur geringe Mengen, Eigenbedarf",
    unvalidated: (n) => `nicht validiert (${n} Funde)`,
    quality: ["kaum besser als Zufall", "schwach", "brauchbar"],
    accuracy: (label, auc, n) => `Trefferqualität ${label} (AUC ${auc}, ${n} Funde)`,
    pop: { trees: "Baumart", nutrients: "Nährkraft", water: "Wasser", soil: "Boden", peat: "Moor",
      protected: "Schutz", natp: "Nationalpark", nsg: "Naturschutzgebiet", banned: "Sammeln meist verboten", noSite: "keine Standortdaten" },
    legend: ["hoch", "mittel", "gering", "Schutzgebiet"],
    close: "Schließen", infoLabel: "Methode, Daten und Rechtliches", mapLabel: "Karte", speciesLabel: "Pilzart", langLabel: "Sprache",
    libFail: "Die Kartenbibliothek konnte nicht geladen werden. Bitte Seite neu laden.",
    model: { calibrated: "kalibriert", prior: "Expertenwerte", untested: "Expertenwerte, ungeprüft" },
    table: ["Art", "Funde", "AUC Experten", "AUC kalibriert", "verwendet"],
    info: {
      what: ["Was die Karte zeigt", "Wo der <b>Lebensraum</b> einer Art passt: Wirtsbaum, Nährkraft und Wasserhaushalt des Bodens. Sie zeigt <b>nicht</b>, wo gerade Pilze stehen. Ob sie fruchten, hängt vom Wetter ab (Regen, dann Wärme, 1 bis 3 Wochen später)."],
      method: ["Methode", "Je 20-m-Zelle: Eignung = Wirtsbaum × Nährkraft × Wasserhaushalt. Baumart: DLR Tree Species Germany 2022 (Sentinel-1/2, 10 m). Boden: die amtliche forstliche Standortskartierung von Brandenburg (1:10 000) und Berlin. Wo keine Standortdaten vorliegen (ca. 28 % des Waldes), wird ein neutraler Faktor verwendet."],
      valid: ["Kalibrierung und Validierung (GBIF-Funde)", "Die Expertentabellen wurden mit ca. 27 000 Pilzfunden aus Berlin und Brandenburg (GBIF, überwiegend iNaturalist) nachjustiert, gedämpft nach Stichprobengröße. Ökologische Ausschlüsse (z. B. Steinpilz auf nassem Boden) bleiben fest. Gemessen wird außerhalb der Stichprobe (5-fache räumliche Kreuzvalidierung, 20-km-Blöcke): Unterscheidet die Karte Fundorte der Art von Fundorten anderer Pilze <i>im Wald</i>? AUC 0,5 = Zufall, 0,7 = brauchbar. Kalibrierung wird nur übernommen, wenn sie besser abschneidet."],
      honest: "Ehrliche Lesart: Die Karte trennt vor allem Kiefernforst auf armem Sand von allem anderen. Innerhalb dieses Blocks (rund die Hälfte des Waldes) kann sie nicht weiter unterscheiden, weil Baumart und Standortklasse dort gleich sind. Ihr Nutzen: ungeeignete Flächen ausschließen.",
      limits: ["Grenzen", "Nur die vorherrschende Baumart je Zelle ist bekannt, eingestreute Birken in Kiefernforsten fehlen. Bestandesalter, Stickstoffeintrag und Wetter fehlen. Fundkoordinaten sind bestenfalls auf 200 m genau. Der Pfifferling wird überschätzt. Kampfmittelbelastete Flächen sind nicht öffentlich kartiert: Sperrschilder beachten."],
      law: ["Recht und Sicherheit", "Steinpilz, Pfifferling, Birkenpilz und Rotkappen sind nach BArtSchV besonders geschützt: nur geringe Mengen für den Eigenbedarf, kein Verkauf. In Naturschutzgebieten und im Nationalpark ist Sammeln meist verboten (schraffiert, Verordnung prüfen). Iss nie einen Pilz, den du nicht sicher bestimmen kannst; im Zweifel zur Pilzberatung (DGfM-Pilzsachverständige). Diese Karte bestimmt keine Pilze."],
      excluded: "Bewusst nicht aufgenommen:",
      data: "Daten",
    },
  },
  fr: {
    colon: " : ",
    months: ["", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    classes: ["nulle", "faible", "moyenne", "élevée"],
    trees: ["Pin", "Épicéa", "Douglas", "Mélèze", "Sapin", "Hêtre", "Chêne", "Bouleau", "Aulne", "Autres feuillus", "Coupe ou dépérissement"],
    noForest: "hors forêt",
    nutrient: ["inconnue", "A pauvre", "A pauvre", "A/Z", "Z assez pauvre", "Z/M", "M moyen", "M/K", "K riche", "K/R", "R très riche"],
    water: ["inconnu", "sec", "assez frais", "faiblement frais (nappe)", "frais", "très frais", "humide", "mouillé", "marécageux"],
    season: (a, b) => `Saison ${a} à ${b}`,
    inSeason: "en saison", outSeason: "hors saison",
    protectedBadge: "Protégé (BArtSchV) : petites quantités, usage personnel",
    unvalidated: (n) => `non validé (${n} observations)`,
    quality: ["à peine mieux que le hasard", "faible", "utile"],
    accuracy: (label, auc, n) => `Fiabilité ${label} (AUC ${auc}, ${n} observations)`,
    pop: { trees: "Essence", nutrients: "Richesse", water: "Eau", soil: "Sol", peat: "tourbe",
      protected: "Protection", natp: "Parc national", nsg: "Réserve naturelle", banned: "cueillette souvent interdite", noSite: "pas de données de station" },
    legend: ["élevée", "moyenne", "faible", "réserve naturelle"],
    close: "Fermer", infoLabel: "Méthode, données et droit", mapLabel: "Carte", speciesLabel: "Espèce", langLabel: "Langue",
    libFail: "La bibliothèque cartographique n'a pas pu se charger. Rechargez la page.",
    model: { calibrated: "calibré", prior: "expert", untested: "expert, non testé" },
    table: ["Espèce", "Observations", "AUC expert", "AUC calibré", "Utilisé"],
    info: {
      what: ["Ce que montre la carte", "Où l'<b>habitat</b> convient à une espèce : arbre hôte, richesse du sol et régime hydrique. Elle ne montre <b>pas</b> où poussent les champignons en ce moment. La fructification dépend de la météo (pluie, puis chaleur, 1 à 3 semaines plus tard)."],
      method: ["Méthode", "Par cellule de 20 m : aptitude = arbre hôte × richesse × régime hydrique. Essences : DLR Tree Species Germany 2022 (Sentinel-1/2, 10 m). Sol : les cartographies officielles des stations forestières du Brandebourg (1:10 000) et de Berlin. Sans données de station (environ 28 % de la forêt), un facteur neutre est utilisé."],
      valid: ["Calibration et validation (observations GBIF)", "Les tables d'experts ont été ajustées avec environ 27 000 observations de champignons à Berlin et dans le Brandebourg (GBIF, surtout iNaturalist), atténuées selon la taille de l'échantillon. Les exclusions écologiques (p. ex. cèpe sur sol détrempé) restent fixes. La qualité est mesurée hors échantillon (validation croisée spatiale en 5 blocs de 20 km) : la carte distingue-t-elle les observations de l'espèce de celles d'autres champignons <i>en forêt</i> ? AUC 0,5 = hasard, 0,7 = utile. La calibration n'est retenue que si elle fait mieux."],
      honest: "Lecture honnête : la carte sépare surtout la pinède sur sable pauvre du reste. À l'intérieur de ce bloc (environ la moitié de la forêt), elle ne peut pas classer davantage, car l'essence et la station y sont identiques. Son intérêt : écarter les terrains inadaptés.",
      limits: ["Limites", "Seule l'essence dominante de chaque cellule est connue : les bouleaux dispersés dans les pinèdes manquent. L'âge des peuplements, les dépôts d'azote et la météo ne sont pas modélisés. Les positions des observations sont précises à 200 m au mieux. La girolle est surestimée. Les terrains pollués par d'anciennes munitions ne sont pas cartographiés publiquement : respectez les panneaux d'interdiction."],
      law: ["Droit et sécurité", "Cèpe, girolle, bolets rudes et bolets orangés sont strictement protégés (BArtSchV) : petites quantités pour usage personnel, vente interdite. La cueillette est souvent interdite dans les réserves naturelles et le parc national (hachurés ; vérifiez le règlement local). Ne mangez jamais un champignon que vous ne savez pas identifier avec certitude ; consultez un conseiller agréé (DGfM Pilzsachverständige). Cette carte n'identifie pas les champignons."],
      excluded: "Volontairement exclus :",
      data: "Données",
    },
  },
};
