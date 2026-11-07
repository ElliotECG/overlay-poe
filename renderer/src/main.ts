import { createApp, watch } from "vue";
import App from "./web/App.vue";
import * as I18n from "./web/i18n";
import * as Data from "./assets/data";
import { initConfig, AppConfig, atziriMigrations } from "./web/Config";
import { Host } from "./web/background/IPC";
import { initTheme } from "./web/atziri-theme";
import { initBackgrounds } from "./web/atziri-backgrounds";
// Atziri Exchange: overlay colors and background images (user-editable)
// before anything renders
initTheme();
initBackgrounds();
(async function () {
  await initConfig();
  const i18nPlugin = await I18n.init(AppConfig().language);
  await Data.init(AppConfig().language);
  await Host.init();
  atziriMigrations();

  watch(
    () => AppConfig().language,
    async () => {
      await Data.loadForLang(AppConfig().language);
      await I18n.loadLang(AppConfig().language);
    },
  );

  const app = createApp(App);
  app.use(i18nPlugin);
  app.mount("#app");
  if (import.meta.env.DEV) {
    app.config.performance = true;
    console.error("DEV MODE");
  }
})();
