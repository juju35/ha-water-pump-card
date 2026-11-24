// One file per language; scripts/bundle.mjs inlines them back into a single object literal at build, which
// scripts/i18n-split.mjs then splits per language (English stays in the bundle).
import en from "./en.js";
import fr from "./fr.js";
import de from "./de.js";
import es from "./es.js";
import sr from "./sr.js";
import srLatn from "./sr-Latn.js";
import it from "./it.js";
import nl from "./nl.js";
import pt from "./pt.js";
import pl from "./pl.js";
import ro from "./ro.js";
import da from "./da.js";
import sv from "./sv.js";
import bg from "./bg.js";
import ru from "./ru.js";
import uk from "./uk.js";
import hu from "./hu.js";
import sk from "./sk.js";
import cs from "./cs.js";
import sl from "./sl.js";
import lv from "./lv.js";
import el from "./el.js";

// Strings shared by the cards; a card's own dictionary wins over these.
export const RC_I18N = {
  en: en.RC_I18N,
  fr: fr.RC_I18N,
  de: de.RC_I18N,
  es: es.RC_I18N,
  sr: sr.RC_I18N,
  "sr-Latn": srLatn.RC_I18N,
  it: it.RC_I18N,
  nl: nl.RC_I18N,
  pt: pt.RC_I18N,
  pl: pl.RC_I18N,
  ro: ro.RC_I18N,
  da: da.RC_I18N,
  sv: sv.RC_I18N,
  bg: bg.RC_I18N,
  ru: ru.RC_I18N,
  uk: uk.RC_I18N,
  hu: hu.RC_I18N,
  sk: sk.RC_I18N,
  cs: cs.RC_I18N,
  sl: sl.RC_I18N,
  lv: lv.RC_I18N,
  el: el.RC_I18N,
};

// Strings of the water pump cards; the shared ones above (unavailable, editor basics) complete them.
export const WP_I18N = {
  en: en.WP_I18N,
  fr: fr.WP_I18N,
  de: de.WP_I18N,
  es: es.WP_I18N,
  sr: sr.WP_I18N,
  "sr-Latn": srLatn.WP_I18N,
  it: it.WP_I18N,
  nl: nl.WP_I18N,
  pt: pt.WP_I18N,
  pl: pl.WP_I18N,
  ro: ro.WP_I18N,
  da: da.WP_I18N,
  sv: sv.WP_I18N,
  bg: bg.WP_I18N,
  ru: ru.WP_I18N,
  uk: uk.WP_I18N,
  hu: hu.WP_I18N,
  sk: sk.WP_I18N,
  cs: cs.WP_I18N,
  sl: sl.WP_I18N,
  lv: lv.WP_I18N,
  el: el.WP_I18N,
};
