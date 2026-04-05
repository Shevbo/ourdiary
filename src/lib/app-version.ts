import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
/** Отображаемое имя релиза (MVP и т.д.) */
export const APP_VERSION_DISPLAY = `${packageJson.version} MVP`;
