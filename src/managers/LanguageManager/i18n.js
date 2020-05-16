import i18n from "i18n-js";
import { I18nManager } from "react-native";
import * as RNLocalize from "react-native-localize";

// Translation files
import en from "./languages/en.json";
import lv from "./languages/lv.json";
import ru from "./languages/ru.json";

i18n.fallbacks = true;
i18n.translations = { en, lv, ru };

const fallback = { languageTag: "en", isRTL: false };
const { languageTag, isRTL } = RNLocalize.findBestAvailableLanguage(Object.keys(i18n.translations)) || fallback;

I18nManager.forceRTL(isRTL); // optional, you might not want to handle RTL
i18n.locale = languageTag;

export default i18n;