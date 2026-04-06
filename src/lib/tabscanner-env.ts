/** Токен Tabscanner API (заголовок apikey). См. https://docs.tabscanner.com/ */
export function getTabscannerApiToken(): string | null {
  const t = process.env.TABSCANNER_API_TOKEN?.trim();
  return t || null;
}
